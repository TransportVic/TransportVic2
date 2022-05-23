const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const async = require('async')
const updateStats = require('../utils/stats')
const utils = require('../../utils')
const turf = require('@turf/turf')

const trainReplacementStops = require('../../additional-data/train-replacement-bays')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let baseURL = 'https://api.mapbox.com/directions/v5/mapbox/driving/{0}?exclude=ferry&continue_straight=false&geometries=geojson&overview=full&radiuses={1}&access_token=' + config.mapboxKey

let city = turf.polygon([[
  [144.946408, -37.8134578],
  [144.9513433, -37.8232552],
  [144.9768779, -37.8164412],
  [144.9722002, -37.8061003],
  [144.946408, -37.8134578]
]])

function distance(a, b) {
  return utils.getDistanceFromLatLon(a[1], a[0], b[1], b[0])
}

function pointsClose(a, b) {
  return distance(a, b) < 50
}

function splitStops(trip) {
  let chunks = []
  let chunkSize = 25
  let stops = trip.stopTimings
  for (let i = 0; i < stops.length; i += chunkSize - 1) {
    chunks.push(stops.slice(i, i + chunkSize))
  }

  return chunks
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

database.connect({}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let routes = database.getCollection('routes')
  let stops = database.getCollection('stops')

  let allRoutes = await routes.distinct('routeGTFSID', {
    mode: 'metro train'
  })

  let excludedStations = [
    'Southland',
    'Huntingdale',
    'Fawkner'
  ]

  let stationLocations = (await stops.findDocuments({ 'bays.mode': 'metro train' }).toArray()).filter(station => {
    return !excludedStations.includes(station.stopName.slice(0, -16))
  }).map(station => {
    let metro = station.bays.find(b => b.mode === 'metro train')
    return metro.location.coordinates
  })

  let count = 0

  let shapeCache = {}

  await async.forEachSeries(allRoutes, async routeGTFSID => {
    let routeData = await routes.findDocument({ routeGTFSID })

    let brokenShapes = await async.filter(routeData.routePath, async path => {
      if (path.isRailBus) return false
      let timetable = await gtfsTimetables.findDocument({ shapeID: path.fullGTFSIDs[0] })
      if (!timetable) return

      shapeCache[path.fullGTFSIDs[0]] = timetable

      let count = path.path.coordinates.filter((point, i) => {
        if (i === 0) return
        let previous = path.path.coordinates[i - 1]

        let prevOnStation = stationLocations.some(s => pointsClose(s, previous))
        let pointOnStation = stationLocations.some(s => pointsClose(s, point))

        return prevOnStation && pointOnStation && distance(previous, point) > 500
      }).length

      return count > 0
    })

    await async.forEachSeries(brokenShapes, async shape => {
      let timetable = shapeCache[shape.fullGTFSIDs[0]]
      if (!timetable) return

      count++

      let fullPath = []

      for (let i = 0; i < timetable.stopTimings.length; i+= 25) {
        let start = i === 0 ? 0 : i - 1
        let relevantStops = timetable.stopTimings.slice(start, i + 25)

        let stopCoordinates = (await async.map(relevantStops, async stop => {
          let stopData = await stops.findDocument({ 'bays.stopGTFSID': stop.stopGTFSID })
          let stopName = stopData.stopName.slice(0, -16)

          let trbsBay

          if (trainReplacementStops[stopName]) {
            let busStop = trainReplacementStops[stopName]

            let allBays = busStop.map(b => turf.point(b.location.coordinates))
            let collection = turf.featureCollection(allBays)
            let centre = turf.center(collection)

            trbsBay = { location: centre.geometry }
          }

          let busBay = stopData.bays.find(bay => bay.mode === 'bus')
          let metroBay = stopData.bays.find(bay => bay.mode === 'metro train')

          let bay = trbsBay || busBay || metroBay

          return bay.location.coordinates.join(',')
        })).join(';')

        let radiuses = relevantStops.map(_ => '500').join(';')

        let url = baseURL.format(stopCoordinates, radiuses)
        if (start !== 0) {
          let lastTwo = fullPath.slice(-2)
          let bearing = turf.bearing(turf.point(lastTwo[0]), turf.point(lastTwo[1]))
          if (bearing < 0) bearing += 360

          url += `&bearings=${bearing},45;`
          url += relevantStops.slice(1).map(_ => '').join(';')
        }

        let routePathData = JSON.parse(await utils.request(url))
        if (!routePathData.routes[0]) return console.log('Failed to generate route path for', timetable)
        let routePath = routePathData.routes[0].geometry.coordinates

        fullPath = fullPath.concat(routePath.slice(i === 0 ? 0 : 1))
      }

      let badPath = routeData.routePath.find(path => path.fullGTFSIDs.includes(timetable.shapeID))

      badPath.path.coordinates = fullPath
      badPath.isRailBus = true

      await asyncPause(750)
    })

    if (brokenShapes.length) {
      await routes.replaceDocument({ routeGTFSID }, routeData)
    }
  })

  await updateStats('mtm-bus-pathing', count)
  console.log('Completed loading in', count, 'route paths')
  process.exit()
});
