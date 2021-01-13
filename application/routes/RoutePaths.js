const express = require('express')
const router = new express.Router()
const async = require('async')
const EventEmitter = require('events')
const encode = require('geojson-polyline').encode

let dataCache
let dataEmitter

async function getData(db) {
  if (dataCache) return dataCache
  if (dataEmitter) {
    return await new Promise(resolve => {
      dataEmitter.on('complete', resolve)
    })
  }

  dataEmitter = new EventEmitter()

  let start = new Date()
  let routes = db.getCollection('routes')
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

    modeRoutePaths[mode] = routePaths.filter(path => {
      return !path.isRailBus
    }).map(path => encode({
      type: "LineString",
      coordinates: path.path
    }, { precision: 5 }).coordinates)
  })

  let end = new Date()
  global.loggers.general.info('[RoutePaths]: Took', end - start, 'ms to compute all polylines')

  dataCache = modeRoutePaths
  dataEmitter.emit('complete', modeRoutePaths)
  dataEmitter = null
  return modeRoutePaths
}

router.get('/', (req, res) => {
  res.render('route-paths')
})

router.post('/', async (req, res) => {
  res.json({ modePaths: await getData(res.db) })
})

module.exports = router
