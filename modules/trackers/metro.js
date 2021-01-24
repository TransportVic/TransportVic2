const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getMetroDepartures = require('../metro-trains/get-departures')
const { findTrip } = getMetroDepartures
const stops = require('../../additional-data/metro-tracker/stops')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const schedule = require('./scheduler')
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let metroTrips

function shouldRun() {
  let minutes = utils.getMinutesPastMidnightNow()
  let dayOfWeek = utils.getDayOfWeek(utils.now())

  if (minutes >= 300 || minutes <= 60) return true

  if (['Sat', 'Sun'].includes(dayOfWeek)) { // Considering the true day, NN runs on sat & sun morn
    return minutes < 300 // 2359 - 0459
  }

  return false
}

function pickRandomStop() {
  return utils.shuffle(stops)[0]
}

async function getDepartures(stop) {
  if (!shouldRun()) return

  let stopData = await dbStops.findDocument({ stopName: stop + ' Railway Station' })
  let departures = await getMetroDepartures(stopData, database)
  let requestLive = departures.filter(d => !d.isRailReplacementBus).slice(0, 6)

  await async.forEachSeries(requestLive, async departure => {
    await getStoppingPattern(database, departure.ptvRunID, 'metro train', departure.scheduledDepartureTime.toISOString())
  })
}

async function requestTimings() {
  let stop = pickRandomStop()
  global.loggers.trackers.metro.info('requesting timings for', stop)

  try {
    await getDepartures(stop)
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to get metro trips this round, skipping', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  metroTrips = database.getCollection('metro trips')

  schedule([
    [0, 60, 1.2],
    [61, 299, 1.2],
    [300, 1079, 0.5],
    [1080, 1199, 0.3333],
    [1200, 1380, 0.5],
    [1381, 1440, 0.45]
  ], requestTimings, 'metro tracker', global.loggers.trackers.metro)
})
