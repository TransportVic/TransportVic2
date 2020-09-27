const express = require('express')
const router = new express.Router()
const async = require('async')

router.get('/', (req, res) => {
  res.render('route-paths')
})

router.post('/', async (req, res) => {
  let start = new Date()
  let routes = res.db.getCollection('routes')
  let modes = ['bus', 'regional train', 'heritage train', 'tram', 'regional coach', 'ferry', 'metro train']

  let modeRoutePaths = {}

  await async.forEach(modes, async mode => {
    let routePaths = (await routes.findDocuments({
      mode
    }).project({
      routePath: 1,
      mode: 1,
      _id: 0
    }).toArray()).reduce((a, b) => a.concat(b.routePath), [])

    modeRoutePaths[mode] = {
      type: "FeatureCollection",
      features: routePaths.map(path => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: path.path
        }
      }))
    }
  })

  let end = new Date()
  console.log('sending data over, took', end - start, 'milliseconds')
  res.json({ modeRoutePaths })
})

module.exports = router
