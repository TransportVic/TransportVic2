const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const getMetroDepartures = require('../modules/metro-trains/get-departures')
const getVLineDepartures = require('../modules/vline/get-departures')
const schedule = require('./trackers/scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = []

async function requestTimings() {
  await async.forEachSeries(stops, async stop => {
    await new Promise(resolve => {
      setTimeout(resolve, 1500)
    })

    global.loggers.trackers.ccl.info('requesting timings for', stop.stopName.slice(0, -16))
    await getMetroDepartures(stop, database)
  })

  global.loggers.trackers.ccl.info('requesting timings for vline southern cross')
  let dbStops = database.getCollection('stops')
  await getVLineDepartures(await dbStops.findDocument({ stopName: 'Southern Cross Railway Station' }), database)
}

database.connect(async () => {
  let dbStops = database.getCollection('stops')

  stops.push(await dbStops.findDocument({ stopName: 'Flagstaff Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Southern Cross Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Flinders Street Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Parliament Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'North Melbourne Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Jolimont Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Richmond Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'North Williamstown Railway Station' }))

  schedule([
    [0, 60, 5], // 12am - 1am
    [240, 1200, 3], // 4am - 8pm
    [1201, 1320, 4], // 8pm - 10pm
    [1201, 1440, 5] // 10pm - 12am
  ], requestTimings, 'city loop preloader', global.loggers.trackers.ccl)
})
