const async = require('async')
const config = require('../config')
const modules = require('../modules')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const getMetroDepartures = require('../modules/metro-trains/get-departures')
const getVLineDepartures = require('../modules/vline/get-departures')

let database
let stops = []

async function requestTimings() {
  await async.forEachSeries(stops, async stop => {
    global.loggers.trackers.ccl.info('requesting timings for', stop.stopName.slice(0, -16))
    await getMetroDepartures(stop, database)
    await utils.sleep(1500)
  })

  global.loggers.trackers.ccl.info('requesting timings for vline southern cross')
  let dbStops = database.getCollection('stops')
  await getVLineDepartures(await dbStops.findDocument({ stopName: 'Southern Cross Railway Station' }), database)
}

if (modules.preloadCCL) {
  database = new DatabaseConnection(config.databaseURL, config.databaseName)
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

    await requestTimings()
    process.exit()
  })
} else process.exit()
