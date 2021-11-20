const express = require('express')
const utils = require('../../utils')
const router = new express.Router()
const turf = require('@turf/turf')

router.post('/:routeGTFSID', async (req, res) => {
  let routes = res.db.getCollection('routes')
  let stops = res.db.getCollection('stops')

  let route = await routes.findDocument({
    routeGTFSID: req.params.routeGTFSID
  })

  if (!route) return res.json(null)

  let routePaths = route.routePath

  let allRoutePaths = {
    type: "FeatureCollection",
    features: routePaths.map(path => ({
      type: "Feature",
      geometry: path.path
    }))
  }

  let stopGTFSIDs = []
  route.directions.forEach(direction => {
    direction.stops.forEach(stop => {
      if (!stopGTFSIDs.includes(stop.stopGTFSID)) {
        stopGTFSIDs.push(stop.stopGTFSID)
      }
    })
  })

  let allStops = await stops.findDocuments({
    'bays.stopGTFSID': {
      $in: stopGTFSIDs
    }
  }).toArray()

  let relevantBays = allStops.map(stop => stop.bays).reduce((a, e) => a.concat(e), []).filter(bay => {
    return stopGTFSIDs.includes(bay.stopGTFSID) && bay.mode === route.mode
  })

  let bbox = turf.bboxPolygon(turf.bbox(allRoutePaths))

  res.json({
    allRoutePaths,
    bbox,
    routeType: route.mode,
    stops: relevantBays
  })
})

router.get('/:routeGTFSID', (req, res) => {
  res.render('route-preview')
})

module.exports = router
