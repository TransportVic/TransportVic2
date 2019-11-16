const async = require('async')
const utils = require('../../utils')

/*

  if offline: needs all GTFS IDs for each bay that matches
  if online: merge by raw ptv stop name, get first

*/
function getUniqueGTFSIDs(station, mode, isOnline, nightBus=false) {
  let gtfsIDs = []
  let bays = station.bays.filter(bay => bay.mode === mode)

  bays = bays.filter(bay => nightBus ^ !(bay.flags && bay.flags.isNightBus && !bay.flags.hasRegularBus))

  if (isOnline) {
    let stopNamesSeen = []
    bays.forEach(bay => {
      if (!stopNamesSeen.includes(bay.originalName)) {
        stopNamesSeen.push(bay.originalName)
        gtfsIDs.push(bay.stopGTFSID)
      }
    })
  } else {
    gtfsIDs = bays.map(bay => bay.stopGTFSID)
  }

  return gtfsIDs
}

async function getDeparture(db, stopGTFSIDs, scheduledDepartureTimeMinutes, destination, mode, day, routeGTFSID) {
  let departureHour = Math.floor(scheduledDepartureTimeMinutes / 60) % 24

  let query = {
    operationDays: day || utils.getYYYYMMDDNow(),
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        departureTimeMinutes: scheduledDepartureTimeMinutes % 1440
      }
    },
    routeGTFSID,
    destination: utils.adjustRawStopName(utils.adjustStopname(destination)),
    // tripStartHour: {
    //   $lte: departureHour
    // },
    // tripEndHour: {
    //   $gte: departureHour
    // }
  }

  // for the coaches
  let trip = await db.getCollection('live timetables').findDocument(query)

  if (!trip)
    trip = await db.getCollection('gtfs timetables').findDocument(query)
  if (trip) {
    let hasSeenStop = false
    trip.stopTimings = trip.stopTimings.filter(stop => {
      if (stopGTFSIDs.includes(stop.stopGTFSID)) {
        hasSeenStop = true
      }
      return hasSeenStop
    })
  }
  return trip
}

async function getScheduledDepartures(stopGTFSIDs, db, mode, timeout, useLive) {
  const timetables = db.getCollection((useLive ? 'live' : 'gtfs') + ' timetables')
  const routes = db.getCollection('routes')
  const minutesPastMidnight = utils.getMinutesPastMidnightNow()

  let trips = await timetables.findDocuments({
    operationDays: utils.getYYYYMMDDNow(),
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        departureTimeMinutes: {
          $gte: minutesPastMidnight - 1,
          $lte: minutesPastMidnight + timeout
        }
      }
    }
  }).toArray()

  return (await async.map(trips, async trip => {
    let stopData = trip.stopTimings.filter(stop => stopGTFSIDs.includes(stop.stopGTFSID))[0]
    let departureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now())

    let hasSeenStop = false
    trip.stopTimings = trip.stopTimings.filter(stop => {
      if (stopGTFSIDs.includes(stop.stopGTFSID)) {
        hasSeenStop = true
      }
      return hasSeenStop
    })

    let route = await routes.findDocument({ routeGTFSID: trip.routeGTFSID })
    let opertor, routeNumber

    let loopDirection
    if (route) {
      operator = route.operators.sort((a, b) => a.length - b.length)[0]
      routeNumber = route.routeNumber

      if (route.flags)
        loopDirection = route.flags[trip.gtfsDirection]

    } else {
      operator = ''
      routeNumber = ''
    }

    let sortNumber = routeNumber
    if (trip.routeGTFSID.startsWith('7-')) {
      routeNumber = routeNumber.slice(2)
      sortNumber = routeNumber.slice(2)
    }

    return {
      trip,
      scheduledDepartureTime: departureTime,
      estimatedDepartureTime: null,
      actualDepartureTime: departureTime,
      scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
      destination: trip.destination,
      routeNumber,
      sortNumber,
      operator,
      codedOperator: utils.encodeName(operator),
      loopDirection
    }
  })).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  getUniqueGTFSIDs,
  getScheduledDepartures,
  getDeparture
}
