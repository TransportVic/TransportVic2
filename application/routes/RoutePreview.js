const express = require('express')
const utils = require('../../utils')
const router = new express.Router()
const turf = require('@turf/turf')

router.post('/:routeGTFSID', async (req, res) => {
  let routes = res.db.getCollection('routes')
  let route = await routes.findDocument({
    routeGTFSID: req.params.routeGTFSID
  })

  if (!route) return res.json(null)

  let routePaths = route.routePath
  if (route.routeGTFSID.startsWith('5-'))
    routePaths = routePaths.filter(path => path.path.length > 50)
  let allRoutePaths = {
    type: "FeatureCollection",
    features: routePaths.map(path => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: path.path
      }
    }))
  }

  let bbox = turf.bboxPolygon(turf.bbox(allRoutePaths))

  res.json({
    allRoutePaths,
    bbox,
    routeType: route.mode
  })
})

router.get('/:routeGTFSID', (req, res) => {
  res.render('route-preview')
})

module.exports = router
