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
      setTimeout(resolve, 1500)
    })

    global.loggers.trackers.ccl.info('requesting timings for', stop.stopName.slice(0, -16))
    await getDepartures(stop, database)
    await getDepartures(stop, database, false, true)
  })
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

  schedule([
    [0, 60, 3], // 12am - 1am
    [240, 1200, 1.5], // 4am - 8pm
    [1201, 1320, 2], // 8pm - 10pm
    [1201, 1440, 2.5] // 10pm - 12am
  ], requestTimings, 'city loop preloader', global.loggers.trackers.ccl)
})
