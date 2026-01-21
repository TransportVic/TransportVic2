const config = require('../../config')
const utils = require('../../utils.mjs')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let liveTimetables

let secondsInDay = 1440 * 60

async function requestDepartureData(now, startOfDay) {
  return await utils.getData('metro-live-departures', 'departures', async () => {
    let data = JSON.parse(await utils.request(urls.metroLiveDepartures, { timeout: 15000 }))

    return data.entries.filter(stop => stop.trip_id.match(/^0[78]/)).map(stop => {
      if (stop.estimated_arrival_time_seconds < 10800) stop.estimated_arrival_time_seconds += secondsInDay
      if (stop.estimated_departure_time_seconds < 10800) stop.estimated_departure_time_seconds += secondsInDay

      stop.estimatedDepartureTime = utils.getMomentFromMinutesPastMidnight(stop.estimated_departure_time_seconds / 60, startOfDay)

      // Some of these stops appear to track with the previous day's (?) times
      // Could create a sudden jump and show incorrect data, happens around midnight
      if (stop.estimated_departure_time_seconds > secondsInDay && stop.estimatedDepartureTime.diff(now, 'minutes') > 55) return null

      return stop
    }).filter(Boolean)
  }, 1000 * 60 * 1)
}

function parseRawData(stop, startOfDay) {
  let arrDiff = stop.estimated_departure_time_seconds - stop.estimated_arrival_time_seconds

  if (stop.estimated_departure_time_seconds < 10800) stop.estimated_departure_time_seconds += secondsInDay
  let minutes = stop.estimated_departure_time_seconds / 60
  let estimatedDepartureTime = utils.getMomentFromMinutesPastMidnight(minutes, startOfDay)

  // These services sometimes show as platform 0
  if (stop.station === 'Wattleglen') stop.station = 'Wattle Glen'
  if (stop.station === 'St Albans') stop.station = 'St. Albans'

  return {
    stopName: stop.station + ' Railway Station',
    estimatedArrivalTime: estimatedDepartureTime.clone().add(-arrDiff, 'seconds'),
    estimatedDepartureTime,
    platform: stop.estimated_platform
  }
}

async function getDepartures() {
  let startOfDay = utils.now().startOf('day')
  let day = utils.getYYYYMMDD(startOfDay)
  let now = utils.now()

  let stopDepartures = await requestDepartureData(now, startOfDay)

  let allTrips = Object.values(stopDepartures.reduce((trips, stop) => {
    let runID = stop.trip_id
    if (!trips[runID]) trips[runID] = {
      runID: runID,
      stopsAvailable: [],
      direction: runID[3] % 2 === 0 ? 'Up' : 'Down',
      operationDays: day
    }

    let parsedStopData = parseRawData(stop, startOfDay)
    trips[runID].stopsAvailable.push(parsedStopData)
    if (parsedStopData.isAdditional) trips[runID].forming = stop.forms_trip_id

    return trips
  }, {}))

  return allTrips
}

async function loadTrips(updateTripData) {
  let allTrips = await getDepartures()

  let bulkOperations = []
  for (let trip of allTrips) {
    if (trip.stopsAvailable.length === 1) continue

    if (trip.stopsAvailable[0].stopName === 'Southern Cross Railway Station') {
      trip.stopsAvailable.unshift({
        stopName: 'Flinders Street Railway Station',
        estimatedDepartureTime: trip.stopsAvailable[0].estimatedArrivalTime.clone().add(-3, 'minutes')
      })
    }

    let lastIndex = trip.stopsAvailable.length - 1
    if (trip.stopsAvailable[lastIndex].estimatedDepartureTime < trip.stopsAvailable[lastIndex - 1].estimatedDepartureTime) {
      trip.stopsAvailable[lastIndex].estimatedDepartureTime = trip.stopsAvailable[lastIndex - 1].estimatedDepartureTime.clone().add(3, 'minutes')
      trip.stopsAvailable[lastIndex].platform = null
    }

    let dbTrip = await liveTimetables.findDocument({
      mode: 'metro train',
      operationDays: trip.operationDays,
      runID: trip.runID
    })

    if (!dbTrip) continue
    let startIndex = dbTrip.stopTimings.findIndex(tripStop => tripStop.stopName === trip.stopsAvailable[0].stopName)
    for (let i = 0; i < trip.stopsAvailable.length; i++) {
      let stopData = trip.stopsAvailable[i]
      let tripStop = dbTrip.stopTimings[i + startIndex]

      tripStop.estimatedDepartureTime = stopData.estimatedDepartureTime.toISOString()
      tripStop.actualDepartureTimeMS = +stopData.estimatedDepartureTime
      if (stopData.platform) tripStop.platform = stopData.platform
    }

    bulkOperations.push({
      replaceOne: {
        filter: { _id: dbTrip._id },
        replacement: dbTrip
      }
    })
  }

  await liveTimetables.bulkWrite(bulkOperations)
  global.loggers.oldTrackers.metro.log(`Successfully updated ${bulkOperations.length} metro trips`)
}

async function requestTimings() {
  global.loggers.oldTrackers.metro.info('Logging Metro CCL trips')

  try {
    await loadTrips()
  } catch (e) {
    global.loggers.oldTrackers.metro.err('Failed to find metro CCL trips, skipping', e)
  }
}

database.connect(async () => {
  liveTimetables = database.getCollection('live timetables')

  schedule([
    [240, 360, 4], // Run until 6am
    // Run just for the live ETA data
    [360, 1199, 3],
    [1200, 1380, 2],
    [1380, 1439, 3]
  ], requestTimings, 'metro ccl', global.loggers.oldTrackers.metro)
})
