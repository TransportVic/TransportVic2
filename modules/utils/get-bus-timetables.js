const async = require('async')
const utils = require('../../utils')
const liveBusData = require('../../additional-data/live-bus-data')

/*

  if offline: needs all GTFS IDs for each bay that matches
  if online: merge by raw ptv stop name, get first

*/
function getUniqueGTFSIDs(station, mode, isOnline, nightBus=false) {
  let gtfsIDs = []
  let bays = station.bays.filter(bay => bay.mode === mode)

  if (mode === 'bus') {
    if (nightBus) {
      bays = bays.filter(bay => (bay.flags && bay.flags.isNightBus))
    } else {
      bays = bays.filter(bay => (bay.flags && bay.flags.hasRegularBus))
    }
  }

  if (isOnline) {
    let stopNamesSeen = []
    bays.forEach(bay => {
      if (bay.screenServices.length === 0) return // Save bandwidth by not requesting dropoff only stops
      let bayGTFSModes = bay.screenServices.map(s => s.routeGTFSID.split('-')[0])
      let shouldRequest = bayGTFSModes.includes('8') // Only request night bus
      if (bayGTFSModes.includes('4')) { // Only request metro if it has routes that are not know to have no tracking
        shouldRequest = bay.screenServices.some(s => !liveBusData.metroRoutesExcluded.includes(s.routeGTFSID))
      }
      if (!shouldRequest && bayGTFSModes.includes('6')) { // Further refine - only load known operators/routes with live data
        shouldRequest = bay.screenServices.some(service => liveBusData.regionalRoutes.includes(service.routeGTFSID))
      }

      if (shouldRequest) {
        if (!stopNamesSeen.includes(bay.originalName) && bay.stopGTFSID < 100000) { // filter out offline override stops
          stopNamesSeen.push(bay.originalName)
          gtfsIDs.push(bay.stopGTFSID)
        }
      }
    })
  } else {
    gtfsIDs = bays.map(bay => bay.stopGTFSID)
  }

  return gtfsIDs
}

async function getDeparture(db, stopGTFSIDs, scheduledDepartureTimeMinutes, destination, mode, day, routeGTFSID, excludedTripIDs, variance=0) {
  let trip
  let today = utils.now()
  let query

  for (let i = 0; i <= 1; i++) {
    let tripDay = today.clone().add(-i, 'days')
    let departureTimeMinutes = scheduledDepartureTimeMinutes % 1440 + 1440 * i
    if (variance) {
      departureTimeMinutes = {
        $gte: departureTimeMinutes - variance,
        $lte: departureTimeMinutes + variance
      }
    }

    query = {
      operationDays: day || utils.getYYYYMMDD(tripDay),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: {
            $in: stopGTFSIDs
          },
          departureTimeMinutes
        }
      },
      destination: utils.adjustRawStopName(utils.adjustStopName(destination))
    }

    if (excludedTripIDs) {
      query.tripID = {
        $not: {
          $in: excludedTripIDs
        }
      }
    }

    if (routeGTFSID) {
      query.routeGTFSID = routeGTFSID
    }

    // for the coaches
    let timetable = await db.getCollection('live timetables').findDocument(query)

    if (!timetable) {
      timetable = await db.getCollection('gtfs timetables').findDocument(query)
    }

    if (timetable) {
      trip = timetable
      break
    }
  }

  if (!trip) {
    if (mode !== 'regional coach')
      global.loggers.general.err('Failed to find timetable:', JSON.stringify(query, null, 1))
    return null
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
          $gte: minutesPastMidnight - 5,
          $lte: minutesPastMidnight + timeout
        }
      }
    }
  }).toArray()

  function i (trip) { return `${trip.routeGTFSID}${trip.origin}${trip.departureTime}${trip.destinationArrivalTime}` }

  let tripsSeen = []
  let filteredTrips = trips.filter(trip => {
    let id = i(trip)
    if (tripsSeen.includes(id)) return false
    tripsSeen.push(id)
    return true
  })

  let routeGTFSIDs = filteredTrips.map(trip => trip.routeGTFSID).filter((e, i, a) => a.indexOf(e) === i)
  let routeCache = {}
  await async.forEach(routeGTFSIDs, async routeGTFSID => {
    routeCache[routeGTFSID] = await routes.findDocument({ routeGTFSID })
  })

  return filteredTrips.map(trip => {
    let stopData = trip.stopTimings.filter(stop => stopGTFSIDs.includes(stop.stopGTFSID))[0]
    let departureTime = utils.getMomentFromMinutesPastMidnight(stopData.departureTimeMinutes, utils.now())

    let route = routeCache[trip.routeGTFSID]
    let opertor, routeNumber

    let loopDirection
    if (route) {
      operator = route.operators.sort((a, b) => a.length - b.length)[0]
      routeNumber = route.routeNumber

      if (route.flags)
        loopDirection = route.flags[trip.gtfsDirection]

      if (route.operationDate) {
        let cutoff = utils.now().startOf('day')
        if (route.operationDate.type === 'until' && route.operationDate.operationDate < cutoff) {
          return null
        }
      }
    } else {
      operator = ''
      routeNumber = ''
    }

    let sortNumber = routeNumber || ''

    if (trip.routeGTFSID.startsWith('7-')) {
      routeNumber = trip.routeGTFSID.slice(2)
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
  }).filter(Boolean).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  getUniqueGTFSIDs,
  getScheduledDepartures,
  getDeparture
}
