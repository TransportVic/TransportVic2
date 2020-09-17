const express = require('express')
const router = new express.Router()
const async = require('async')

router.get('/', (req, res) => {
  res.render('route-paths')
})

let coachExcluded = [
  "5-Ech",
  "5-my1",
  "5-Sht",
  "5-V04",
  "5-V05",
  "5-V08",
  "5-V12",
  "5-V23",
  "5-V40",
  "5-V45",
  "5-V48",
  "5-V51"
]

router.post('/', async (req, res) => {
  let start = new Date()
  let routes = res.db.getCollection('routes')
  let modes = ['bus', 'metro train', 'regional train', 'heritage train', 'tram', 'regional coach', 'ferry']

  let modeRoutePaths = {}

  await async.forEach(modes, async mode => {
    let routePaths = (await routes.findDocuments({
      mode,
      routeGTFSID: {
        $not: {
          $in: coachExcluded
        }
      }
    }).project({
      routePath: 1,
      mode: 1,
      _id: 0
    }).toArray()).reduce((a, routeData) => {
      let {routePath} = routeData
      if (routeData.mode === 'regional coach')
        routePath = routePath.filter(path => path.path.length > 50)

      return a.concat(routePath)
    }, [])

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
