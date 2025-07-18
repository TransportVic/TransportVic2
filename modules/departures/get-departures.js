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

  if (!stopGTFSIDs.length) stopGTFSIDs = station.bays.map(bay => bay.stopGTFSID)

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
        actualDepartureTimeMS
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

    let allowableTimes = {
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
          $or: [{
            departureTimeMinutes: allowableTimes
          }, {
            arrivalTimeMinutes: allowableTimes
          }]
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

async function getCombinedDepartures(station, mode, db, { departureTime = null, timeframe = 120 }={}) {
  departureTime = departureTime ? utils.parseTime(departureTime) : utils.now()

  let departures, useLive = shouldUseLiveDepartures(departureTime)
  let liveTrips = await fetchLiveTrips(station, mode, db, departureTime, timeframe)

  if (useLive) departures = liveTrips
  else departures = await fetchScheduledTrips(station, mode, db, departureTime, timeframe)

  if (!useLive && liveTrips.length) {
    for (let liveTrip of liveTrips) {
      let matchingScheduled = departures.findIndex(scheduled => {
        if (typeof liveTrip.runID !== 'undefined' && liveTrip.runID === scheduled.runID) return true
        if (typeof liveTrip.tripID !== 'undefined' && liveTrip.tripID === scheduled.tripID) return true
        if (
          liveTrip.origin === scheduled.origin && liveTrip.destination === scheduled.destination
          && liveTrip.departureTime === scheduled.departureTime
          && liveTrip.destinationArrivalTime === scheduled.destinationArrivalTime
        ) return true
      })
      if (matchingScheduled === -1) { // Extra trip, insert it in
        departures.push(liveTrip)
      } else {
        departures[matchingScheduled] = liveTrip
      }
    }
  }

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

async function getDepartures(station, mode, db, { departureTime = null, timeframe = 120, returnArrivals = false } = {}) {
  let stopGTFSIDs = station.bays.map(stop => stop.stopGTFSID)
  departureTime = departureTime ? utils.parseTime(departureTime) : utils.now()

  let combinedDepartures = await getCombinedDepartures(station, mode, db, { departureTime, timeframe })
  let departures = []

  for (let trip of combinedDepartures) {
    let stopIndices = trip.stopTimings
      .slice(0, returnArrivals ? trip.stopTimings.length : -1) // Exclude the last stop
      .map((stop, i) => ({ m: stopGTFSIDs.includes(stop.stopGTFSID), i }))
      .filter(e => e.m)
      .map(e => e.i)

    let prevVisitSchDep = null

    for (let currentStopIndex of stopIndices) {
      let currentStop = trip.stopTimings[currentStopIndex]

      let scheduledDepartureTime = utils.parseTime(currentStop.scheduledDepartureTime)
      let estimatedDepartureTime = currentStop.estimatedDepartureTime ? utils.parseTime(currentStop.estimatedDepartureTime) : null

      if (prevVisitSchDep !== null && scheduledDepartureTime.diff(prevVisitSchDep, 'minutes') <= 2) continue
      prevVisitSchDep = scheduledDepartureTime
      
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
      if (departureTime.diff(actualDepartureTime, 'minutes') > 1) continue

      departures.push({
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        currentStop,
        cancelled: trip.cancelled || currentStop.cancelled,
        routeName: trip.routeName,
        cleanRouteName: utils.encodeName(trip.routeName),
        trip,
        destination: trip.destination,
        departureDay: trip.operationDays,
        departureDayMoment: utils.parseDate(trip.operationDays),
        allStops: trip.stopTimings.map(stop => stop.stopName),
        futureStops: trip.stopTimings.slice(currentStopIndex + 1).map(stop => stop.stopName),
        isArrival: currentStopIndex === trip.stopTimings.length - 1
      })
    }
  }

  return departures.sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  fetchLiveTrips,
  fetchScheduledTrips,
  getCombinedDepartures,
  getDepartures,
  shouldUseLiveDepartures
}