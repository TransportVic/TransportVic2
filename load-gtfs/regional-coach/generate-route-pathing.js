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

database.connect({}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let routes = database.getCollection('routes')
  let stops = database.getCollection('stops')

  let allRoutes = await routes.distinct('routeGTFSID', {
    mode: 'regional coach'
  })

  let count = 0

  await async.forEachSeries(allRoutes, async routeGTFSID => {
    let routeData = await routes.findDocument({ routeGTFSID })
    let brokenShapes = routeData.routePath.filter(path => {
      let forceFail = false

      return path.path.filter((point, i) => {
        let size = 3
        if (i < size) return false
        let distanceSum = 0

        for (let j = i; j > i - size; j--) {
          let pointA = path.path[j]
          let pointB = path.path[j - 1]
          distanceSum += turf.distance(turf.point(pointA), turf.point(pointB))
        }
        if (distanceSum >= 30) forceFail = true
        if (distanceSum >= 20) return true

        return false
      }).length > 2 || forceFail
    })

    await async.forEachSeries(brokenShapes, async shape => {
      let timetable = await gtfsTimetables.findDocument({ shapeID: shape.fullGTFSIDs[0] })
      if (!timetable) return
      if (timetable.stopTimings.length > 25) return console.log('Don\'t know how to deal with long route!', timetable.shapeID)

      count++

      let stopCoordinates = (await async.map(timetable.stopTimings, async stop => {
        let stopData = await stops.findDocument({ 'bays.stopGTFSID': stop.stopGTFSID })
        let bay = stopData.bays.find(bay => bay.stopGTFSID === stop.stopGTFSID && bay.mode === 'regional coach')
        return bay.location.coordinates.join(',')
      })).join(';')

      let radiuses = timetable.stopTimings.map(_ => '200').join(';')

      let url = baseURL.format(stopCoordinates, radiuses)
      let routePathData = JSON.parse(await utils.request(url))
      if (!routePathData.routes[0]) return console.log('Failed to generate route path for', timetable)
      let routePath = routePathData.routes[0].geometry

      routeData.routePath.find(path => path.fullGTFSIDs.includes(timetable.shapeID)).path = routePath.coordinates
      await asyncPause(750)
    })

    if (brokenShapes.length) await routes.replaceDocument({ routeGTFSID }, routeData)
  })

  await updateStats('coach-pathing', count)
  console.log('Completed loading in', count, 'route paths')
  process.exit()
});
