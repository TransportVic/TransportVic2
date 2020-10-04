const async = require('async')
const utils = require('../../utils')

let liveRegionalRoutes = [
  "6-B05",
  "6-B10",
  "6-B50",
  "6-B51",
  "6-B52",
  "6-B53",
  "6-B54",
  "6-B55",
  "6-B60",
  "6-B61",
  "6-B62",
  "6-B63",
  "6-B64",
  "6-B65",
  "6-B70",
  "6-B7o",
  "6-G01",
  "6-G10",
  "6-G11",
  "6-G12",
  "6-G19",
  "6-G20",
  "6-G22",
  "6-G23",
  "6-G24",
  "6-G25",
  "6-G30",
  "6-G31",
  "6-G32",
  "6-G40",
  "6-G41",
  "6-G42",
  "6-G43",
  "6-G45",
  "6-G50",
  "6-G51",
  "6-G55",
  "6-G56",
  "6-G60",
  "6-G61",
  "6-G6L",
  "6-G6X",
  "6-L01",
  "6-L02",
  "6-L03",
  "6-L04",
  "6-L05",
  "6-L06",
  "6-L07",
  "6-L08",
  "6-L11",
  "6-L12",
  "6-L13",
  "6-L14",
  "6-L15",
  "6-L20",
  "6-L22",
  "6-L30",
  "6-L40",
  "6-L41",
  "6-L42",
  "6-L43",
  "6-L44",
  "6-L45",
  "6-W80",
  "6-W81",
  "6-W82",
  "6-W83",
  "6-W85",
  "6-W86",
  "6-cvx",
  "6-dcf",
  "6-fgt",
  "6-ggg",
  "6-hnb",
  "6-jjg",
  "6-lkm",
  "6-lng",
  "6-lok",
  "6-mnm",
  "6-ndb",
  "6-sdf",
  "6-tyt",
  "6-xyz"
]

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
      let shouldRequest = bayGTFSModes.includes('4') || bayGTFSModes.includes('8') // Only request metro & night bus
      if (!shouldRequest && bayGTFSModes.includes('6')) { // Further refine - only load known operators/routes with live data
        shouldRequest = bay.screenServices.some(service => liveRegionalRoutes.includes(service.routeGTFSID))
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
      console.err('Failed to find timetable: ', JSON.stringify(query, null, 1))
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

  return (await async.map(filteredTrips, async trip => {
    let stopData = trip.stopTimings.filter(stop => stopGTFSIDs.includes(stop.stopGTFSID))[0]
    let departureTime = utils.getMomentFromMinutesPastMidnight(stopData.departureTimeMinutes, utils.now())

    let route = await routes.findDocument({ routeGTFSID: trip.routeGTFSID })
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
  })).filter(Boolean).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  getUniqueGTFSIDs,
  getScheduledDepartures,
  getDeparture
}
