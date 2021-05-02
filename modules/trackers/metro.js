const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getMetroDepartures = require('../metro-trains/get-departures')
const { findTrip } = getMetroDepartures
const stops = require('../../additional-data/metro-tracker/stops')
const getStoppingPattern = require('../metro-trains/get-stopping-pattern')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let metroTrips

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
  let requestLive = departures.filter(d => !d.isRailReplacementBus).slice(0, 5)

  await async.forEachSeries(requestLive, async departure => {
    if (departure.ptvRunID) { // Remember local departures do not have a run id
      await getStoppingPattern({
        ptvRunID: departure.ptvRunID,
        time: departure.originDepartureTime.toISOString(),
        referenceTrip: departure.trip
      }, database)
    }
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

async function trainCount(stopGTFSID) {
  let { departures } = await ptvAPI(`/v3/departures/route_type/0/stop/${stopGTFSID}?gtfs=true&max_results=7&include_cancelled=true`, 3, 3000)
  let today = utils.getYYYYMMDDNow()

  let trains = departures.filter(departure => {
    if (!departure.flags.includes('RRB')) {
      let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
      return utils.getYYYYMMDD(scheduledDepartureTime) === today
    }
  })

  return trains.length
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  metroTrips = database.getCollection('metro trips')

  try {
    if (await trainCount(20227) >= 4) {
      stops.push('Flemington Racecourse')
      global.loggers.trackers.metro.log('Found at least 4 RCE trains, monitoring RCE')
    }
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to check RCE trips, assuming none', e)
  }

  try {
    if (await trainCount(20228) >= 4) {
      stops.push('Showgrounds')
      global.loggers.trackers.metro.log('Found at least 4 SGS trains, monitoring SGS')
    }
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to check SGS trips, assuming none', e)
  }

  schedule([
    [0, 60, 1],
    [61, 239, 0.4],
    [240, 1199, 0.25],
    [1200, 1380, 0.5],
    [1381, 1440, 0.4]
  ], requestTimings, 'metro tracker', global.loggers.trackers.metro)
})
