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

  let departureTimeMinutes = backwards ? {
    $gte: rawDepartureTimeMinutes - timeframe,
    $lte: rawDepartureTimeMinutes
  } : {
    $gte: rawDepartureTimeMinutes - 1,
    $lte: rawDepartureTimeMinutes + timeframe
  }

  let trips = await gtfsTimetables.findDocuments({
    mode: 'metro train',
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        departureTimeMinutes
      }
    },
  }).toArray()

  return trips
}

async function getDepartures(station, db, options={}) {
  let { lookBackwards, departureTime } = options
}

module.exports = {
  fetchLiveTrips,
  getDepartures
}