const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const getDepartures = require('../modules/metro-trains/get-departures')
const schedule = require('./trackers/scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = []

async function requestTimings() {
  await async.forEachSeries(stops, async stop => {
    await new Promise(resolve => {
      setTimeout(resolve, 1000)
    })

    global.loggers.trackers.ccl.info('requesting timings for', stop.stopName.slice(0, -16))
    await getDepartures(stop, database)
  })
}

database.connect(async () => {
  let dbStops = database.getCollection('stops')

  stops.push(await dbStops.findDocument({ stopName: 'Flagstaff Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Southern Cross Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Flinders Street Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Parliament Railway Station' }))

  schedule([
    [0, 60, 12],
    [240, 1200, 6],
    [1201, 1440, 10]
  ], requestTimings, 'city loop preloader', global.loggers.trackers.ccl)
})
