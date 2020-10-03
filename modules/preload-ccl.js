const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const getDepartures = require('../modules/metro-trains/get-departures')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = []

async function requestTimings() {
  await async.forEachSeries(stops, async stop => {
    await new Promise(resolve => {
      setTimeout(resolve, 10000)
    })
    await getDepartures(stop, database)
  })
}

database.connect(async () => {
  let dbStops = database.getCollection('stops')

  stops.push(await dbStops.findDocument({ stopName: 'Flagstaff Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Southern Cross Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Flinders Street Railway Station' }))
  stops.push(await dbStops.findDocument({ stopName: 'Parliament Railway Station' }))

  setInterval(requestTimings, 30 * 60 * 1000)
  await requestTimings()
})
