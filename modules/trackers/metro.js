const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getMetroDepartures = require('../metro-trains/get-departures')
const stops = require('../../additional-data/metro-tracker/stops')
const getStoppingPattern = require('../metro-trains/get-stopping-pattern')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let liveimetables

function shouldRun() {
  let minutes = utils.getMinutesPastMidnightNow()
  let dayOfWeek = utils.getDayOfWeek(utils.now())

  if (minutes >= 240 || minutes <= 60) return true // from 4am to 1am (next day)

  if (['Sat', 'Sun'].includes(dayOfWeek)) { // Considering the true day, NN runs on sat & sun morn
    return minutes < 240 // 2359 - 0459
  }

  return false
}

function pickRandomStop() {
  return utils.shuffle(stops)[0]
}

async function getDepartures(stop) {
  let stopData = await dbStops.findDocument({ stopName: stop + ' Railway Station' })
  let departures = await getMetroDepartures(stopData, database)

  let requestLive = departures.filter(d => d.runID).slice(0, 5)
  await async.forEachSeries(requestLive, async departure => {
    await getStoppingPattern({
      ptvRunID: utils.getPTVRunID(departure.runID),
      time: departure.originDepartureTime.toISOString(),
      referenceTrip: departure.trip
    }, database)
  })

  await getMetroDepartures(stopData, database, false, true)
}

async function requestTimings() {
  if (!shouldRun()) return

  let stop = pickRandomStop()
  global.loggers.trackers.metro.info('requesting timings for', stop)

  try {
    await getDepartures(stop)
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to get metro trips this round, skipping', e)
  }
}

async function trainCount(stopName) {
  let count = await liveTimetables.countDocuments({
    mode: 'metro train',
    operationDays: utils.getYYYYMMDDNow(),
    'stopTimings.stopName': `${stopName} Railway Station`
  })

  return count
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  liveTimetables = database.getCollection('live timetables')

  try {
    if (await trainCount('Flemington Racecourse') >= 4) {
      stops.push('Flemington Racecourse')
      global.loggers.trackers.metro.log('Found at least 4 RCE trains, monitoring RCE')
    }
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to check RCE trips, assuming none', e)
  }

  try {
    if (await trainCount('Showgrounds') >= 4) {
      stops.push('Showgrounds')
      global.loggers.trackers.metro.log('Found at least 4 SGS trains, monitoring SGS')
    }
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to check SGS trips, assuming none', e)
  }

  schedule([
    [0, 180, 0.66667],
    [181, 239, 1],
    [240, 1199, 0.66667],
    [1200, 1440, 1],
  ], requestTimings, 'metro tracker', global.loggers.trackers.metro)
})
