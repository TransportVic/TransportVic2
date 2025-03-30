const utils = require('../../utils')
const { getNonDSTMinutesPastMidnight } = require('../dst/dst')
const { convertToLive } = require('./sch-to-live')

/**
 * 
 * @param {Object} station The station data as stored in the database
 * @param {DatabaseConnection} db The database connection
 * @param {Date} departureTime The departure time to look from
 * @param {Number} timeframe The number of minutes worth of departures to capture
 * @param {Boolean} backwards If previous departures should be fetched
 */
async function fetchLiveTrips(station, mode, db, departureTime, timeframe=120) {
  let liveTimetables = db.getCollection('live timetables')
  let stopGTFSIDs = station.bays
    .filter(bay => bay.mode === mode)
    .map(bay => bay.stopGTFSID)

  let timeMS = +departureTime
  let timeoutMS = timeframe * 60 * 1000

  let actualDepartureTimeMS = {
    $gte: timeMS - 1000 * 60,
    $lte: timeMS + timeoutMS
  }

  let trips = await liveTimetables.findDocuments({
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        actualDepartureTimeMS,
        departureTime: { $ne: null }
      }
    },
  }).toArray()

  return trips
}

async function fetchScheduledTrips(station, mode, db, departureTime, timeframe=120) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let stopGTFSIDs = station.bays
    .filter(bay => bay.mode === mode)
    .map(bay => bay.stopGTFSID)

  // Get the non DST aware minutes past midnight - the times would be saved normally
  let rawDepartureTimeMinutes = getNonDSTMinutesPastMidnight(departureTime)
  let departureDay = utils.parseTime(departureTime).startOf('day')

  let trips = []

  for (let i = 1; i >= 0; i--) { // Run in reverse to get a naturally sorted order
    let minutesOffset = i * 1440 // Note - fix as 1440 first and have a think if it needs to be dynamic
    let operationDay = departureDay.clone().add(-i, 'days')

    let departureTimeMinutes = {
      $gte: rawDepartureTimeMinutes - 1 + minutesOffset,
      $lte: rawDepartureTimeMinutes + timeframe + minutesOffset
    }

    let dayTrips = await gtfsTimetables.findDocuments({
      mode,
      operationDays: utils.getYYYYMMDD(operationDay),
      stopTimings: {
        $elemMatch: {
          stopGTFSID: {
            $in: stopGTFSIDs
          },
          departureTimeMinutes
        }
      },
    }).toArray()

    trips.push(...dayTrips.map(trip => convertToLive(trip, operationDay)))
  }

  return trips
}

function shouldUseLiveDepartures(departureTime) {
  // Set to 3 hours as DST could mean there are actually 4 hours inbetween
  let endOfPTDayTomorrow = utils.now().startOf('day').add(2, 'days').set('hours', 3)
  return departureTime < endOfPTDayTomorrow
}

async function getCombinedDepartures(station, mode, db, options={}) {
  let { departureTime, timeframe } = options
  departureTime = departureTime ? utils.parseTime(departureTime) : utils.now()
  timeframe = timeframe || 120

  let stopGTFSIDs = station.bays.map(stop => stop.stopGTFSID)

  let departures, useLive = shouldUseLiveDepartures(departureTime)
  if (useLive) departures = await fetchLiveTrips(station, mode, db, departureTime, timeframe)
  else departures = await fetchScheduledTrips(station, mode, db, departureTime, timeframe)

  let departureEndTime = departureTime.clone().add(timeframe, 'minutes')

  // The departure time crossed the PT day and we need to use scheduled times for the rest
  if (useLive && !shouldUseLiveDepartures(departureEndTime)) {
    let ptDayStart = departureEndTime.clone().startOf('day').set('hours', 3)
    let remainingMinutes = departureEndTime.diff(ptDayStart, 'minutes')

    let missingTrips = await fetchScheduledTrips(station, mode, db, ptDayStart, remainingMinutes, false)
    departures.push(...missingTrips)
  }

  return departures
}

async function getDepartures(station, mode, db, options={}) {
  let departures = await getCombinedDepartures(station, mode, db, options)

  .map(trip => {
    return {
      trip,
      stop: trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
    }
  }).sort((a, b) => a.stop.actualDepartureTimeMS - b.stop.actualDepartureTimeMS)
  .map(t => t.trip)
}

module.exports = {
  fetchLiveTrips,
  fetchScheduledTrips,
  getCombinedDepartures,
  shouldUseLiveDepartures
}