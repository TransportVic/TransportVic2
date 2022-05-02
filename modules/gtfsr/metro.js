const async = require('async')
const config = require('../../config')
const modules = require('../../modules')
const utils = require('../../utils')
const moment = require('moment')
const { makePBRequest } = require('./gtfsr-api')
const DatabaseConnection = require('../../database/DatabaseConnection')
const findConsist = require('../metro-trains/fleet-parser')
const mergeConsist = require('../metro-trains/merge-consist')

let database
let metroTrips, liveTimetables

async function fetchAndUpdate() {
  global.loggers.trackers.metro.info('updating metro gtfs-r data')

  let vehicleData = await makePBRequest('metrotrain-vehicleposition-updates')

  await async.forEach(vehicleData.entity, async data => {
    let runID = data.id.slice(-4)
    let tripDate = data.vehicle.trip.start_date
    let startTime = data.vehicle.trip.start_time
    let startHour = parseInt(startTime.slice(0, 2))
    if (startHour >= 24) { // Wind it back a day
      tripDate = utils.getYYYYMMDD(utils.parseDate(tripDate).add(-1, 'day'))
    }

    let consist = findConsist(data.vehicle.vehicle.id, runID)

    let tripData = await liveTimetables.findDocument({
      mode: 'metro train',
      operationDays: tripDate,
      runID
    })

    if (consist && tripData) await mergeConsist(tripData, consist, metroTrips)
  })
}

if (modules.gtfsr && modules.gtfsr.metro) {
  database = new DatabaseConnection(config.databaseURL, config.databaseName)
  database.connect(async () => {
    liveTimetables = database.getCollection('live timetables')
    metroTrips = database.getCollection('metro trips')

    // Cron only has a minute level scheduling, so sleep and run twice per cycle for a 30s update
    await fetchAndUpdate()
    await utils.sleep(30 * 1000)
    await fetchAndUpdate()

    process.exit()
  })
} else process.exit()
