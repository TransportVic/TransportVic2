const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const async = require('async')
const updateStats = require('../utils/stats')
const utils = require('../../utils')
const turf = require('@turf/turf')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let baseURL = 'https://api.mapbox.com/directions/v5/mapbox/driving/{0}?exclude=ferry&continue_straight=false&geometries=geojson&overview=full&radiuses={1}&access_token=' + config.mapboxKey

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

let knownBadRoutes = [
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

let smallerErrorRoutes = [
  "5-V12",
  "5-V24"
]

database.connect({}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let routes = database.getCollection('routes')
  let stops = database.getCollection('stops')

  let allRoutes = await routes.distinct('routeGTFSID', {
    mode: 'regional coach'
  })

  let count = 0

  let shapeCache = {}

  await async.forEachSeries(allRoutes, async routeGTFSID => {
    let routeData = await routes.findDocument({ routeGTFSID })

    let brokenShapes = await async.filter(routeData.routePath, async path => {
      if (path.fixed) return false
      let timetable = await gtfsTimetables.findDocument({ shapeID: path.fullGTFSIDs[0] })
      if (!timetable) return

      shapeCache[path.fullGTFSIDs[0]] = timetable
      if ([timetable.origin, timetable.destination].includes('Southern Cross Coach Terminal/Spencer Street')) return true

      let forceFail = false

      let forceFailLength = 25
      let failLength = 15

      if (smallerErrorRoutes.includes(routeGTFSID)) {
        forceFailLength = 3
      } else if (knownBadRoutes.includes(routeGTFSID) || path.length < 40 * 1000) {
        forceFailLength = 10
        failLength = 5
      } else if (path.length < 100 * 1000) {
        forceFailLength = 15
        failLength = 10
      }

      return path.path.coordinates.filter((point, i) => {
        let size = 3
        if (i < size) return false
        let distanceSum = 0

        for (let j = i; j > i - size; j--) {
          let pointA = path.path.coordinates[j]
          let pointB = path.path.coordinates[j - 1]
          distanceSum += turf.distance(turf.point(pointA), turf.point(pointB))
        }

        if (distanceSum >= forceFailLength) return forceFail = true
        if (distanceSum >= failLength) return true

        return false
      }).length > 2 || forceFail
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
          if (stop.stopName === 'Southern Cross Coach Terminal/Spencer Street') return '144.952117,-37.815994'
          let stopData = await stops.findDocument({ 'bays.stopGTFSID': stop.stopGTFSID })
          let bay = stopData.bays.find(bay => bay.stopGTFSID === stop.stopGTFSID && bay.mode === 'regional coach')
          return bay.location.coordinates.join(',')
        })).join(';')

        let radiuses = relevantStops.map(_ => '200').join(';')

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
      badPath.fixed = true

      await asyncPause(750)
    })

    if (brokenShapes.length) {
      await routes.replaceDocument({ routeGTFSID }, routeData)
    }
  })

  await updateStats('coach-pathing', count)
  console.log('Completed loading in', count, 'route paths')
  process.exit()
});
