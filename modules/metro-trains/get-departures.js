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
async function fetchLiveTrips(station, db, departureTime, timeframe=120, backwards=false) {
  let liveTimetables = db.getCollection('live timetables')
  let stopGTFSIDs = station.bays
    .filter(bay => bay.mode === 'metro train')
    .map(bay => bay.stopGTFSID)

  let timeMS = +departureTime
  let timeoutMS = timeframe * 60 * 1000

  let actualDepartureTimeMS = backwards ? {
    $gte: timeMS - timeoutMS,
    $lte: timeMS
  } : {
    $gte: timeMS - 1000 * 60,
    $lte: timeMS + timeoutMS
  }

  let trips = await liveTimetables.findDocuments({
    mode: 'metro train',
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        actualDepartureTimeMS
      }
    },
  }).toArray()

  return trips
}

async function fetchScheduledTrips(station, db, departureTime, timeframe=120, backwards=false) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let stopGTFSIDs = station.bays
    .filter(bay => bay.mode === 'metro train')
    .map(bay => bay.stopGTFSID)

  // Get the non DST aware minutes past midnight - the times would be saved normally
  let rawDepartureTimeMinutes = getNonDSTMinutesPastMidnight(departureTime)
  let departureDay = utils.parseTime(departureTime).startOf('day')

  let trips = []

  for (let i = 1; i >= 0; i--) { // Run in reverse to get a naturally sorted order
    let minutesOffset = i * 1440 // Note - fix as 1440 first and have a think if it needs to be dynamic
    let operationDay = departureDay.clone().add(-i, 'days')

    let departureTimeMinutes = backwards ? {
      $gte: rawDepartureTimeMinutes - timeframe + minutesOffset,
      $lte: rawDepartureTimeMinutes + minutesOffset
    } : {
      $gte: rawDepartureTimeMinutes - 1 + minutesOffset,
      $lte: rawDepartureTimeMinutes + timeframe + minutesOffset
    }

    let dayTrips = await gtfsTimetables.findDocuments({
      mode: 'metro train',
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
  let endOfPTDayToday = utils.now().startOf('day').add(1, 'day').add(3, 'hours')
  return departureTime < endOfPTDayToday
}

async function getDepartures(station, db, options={}) {
  let { lookBackwards, departureTime } = options
  departureTime = departureTime ? utils.parseTime(departureTime) : utils.now()

}

module.exports = {
  fetchLiveTrips,
  fetchScheduledTrips,
  getDepartures,
  shouldUseLiveDepartures
}