const express = require('express')
const router = new express.Router()
const async = require('async')

router.get('/', (req, res) => {
  res.render('route-paths')
})

router.post('/', async (req, res) => {
  let routes = res.db.getCollection('routes')
  let modes = ['bus', 'metro train', 'regional train', 'heritage train', 'tram', 'regional coach', 'ferry']

  let modeRoutePaths = {}

  await async.forEach(modes, async mode => {
    let routePaths = (await routes.findDocuments({ mode }, {
      routePath: 1
    }).toArray()).reduce((a, e) => a.concat(e.routePath), [])

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

  res.json({ modeRoutePaths })
  console.log('sending data over')
})

module.exports = router
