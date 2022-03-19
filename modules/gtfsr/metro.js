const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const moment = require('moment')
const { makePBRequest } = require('./gtfsr-api')
const DatabaseConnection = require('../../database/DatabaseConnection')
const findConsist = require('../metro-trains/fleet-parser')
const mergeConsist = require('../metro-trains/merge-consist')
const schedule = require('../trackers/scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let metroTrips, liveTimetables

async function fetchAndUpdate() {
  global.loggers.trackers.metro.info('updating metro gtfs-r data')

  let vehicleData = await makePBRequest('metrotrain-vehicleposition-updates')

  await async.forEach(vehicleData.entity, async data => {
    let runID = data.id.slice(-4)
    let tripDate = data.vehicle.trip.start_date
    let consist = findConsist(data.vehicle.vehicle.id, runID)

    let tripData = await liveTimetables.findDocument({
      mode: 'metro train',
      operationDays: tripDate,
      runID
    })

    if (consist && tripData) await mergeConsist(tripData, consist, metroTrips)
  })
}

database.connect(async () => {
  liveTimetables = database.getCollection('live timetables')
  metroTrips = database.getCollection('metro trips')

  schedule([
    [0, 60, 0.5],
    [61, 239, 0.5],
    [240, 1199, 0.5],
    [1200, 1440, 0.5],
  ], fetchAndUpdate, 'metro gtfsr', global.loggers.trackers.metro)
})
