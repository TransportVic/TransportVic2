import async from 'async'
import utils from '../../utils.mjs'
import overrideStops from '../bus/override-stops.json' with { type: 'json' }

/*

  if offline: needs all GTFS IDs for each bay that matches
  if online: merge by raw ptv stop name, get first

*/
function getUniqueGTFSIDs(station, mode, isOnline) {
  let gtfsIDs = []
  let bays = station.bays.filter(bay => bay.mode === mode)

  if (isOnline) {
    let stopNamesSeen = []
    bays.forEach(bay => {
      if (bay.screenServices.length === 0) return // Save bandwidth by not requesting dropoff only stops

      let bayName = `${bay.originalName} (${bay.suburb})`
      if (!stopNamesSeen.includes(bayName)) { // filter out offline override stops
        stopNamesSeen.push(bayName)
        gtfsIDs.push(bay.stopGTFSID)
      }
    })
  } else {
    gtfsIDs = bays.map(bay => bay.stopGTFSID)
  }

  return gtfsIDs
}

async function getStop(stopData, stopsCollection) {
  let rawStopName = stopData.stop_name
  let stopName = utils.getProperStopName(rawStopName.trim())

  let matchedStop = await stopsCollection.findDocument({
    $or: [{
      'bays.fullStopName': stopName
    }, {
      stopName,
    }],
    'bays.mode': 'bus',
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [stopData.stop_longitude, stopData.stop_latitude]
        },
        $maxDistance: 200
      }
    }
  })
  if (matchedStop) return matchedStop

  let matchedOnName = await stopsCollection.findDocuments({
    $or: [{
      'bays.fullStopName': stopName
    }, {
      stopName,
    }],
    'bays.mode': 'bus'
  }).toArray()

  if (matchedOnName.length === 1) {
    global.loggers.general.err('PTV Stop Position Mismatch', stopData, matchedOnName[0].location)
    return matchedOnName[0]
  }

  let closeStop = await stopsCollection.findDocuments({
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [stopData.stop_longitude, stopData.stop_latitude]
        },
        $maxDistance: 20
      }
    }
  }).limit(2).toArray()

  if (closeStop.length !== 0) {
    if (!overrideStops[stopData.stop_id]) global.loggers.general.err('PTV Name Mismatch', stopData, closeStop[0].stopName)
    return closeStop[0]
  } else {
    return null
  }
}

async function getDeparture(db, stopGTFSIDs, departureTime, destination, mode, routeGTFSID, excludedTripIDs, variance=0, routeNumber, silent, tripID) {
  let trip
  let query

  let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)

  for (let i = 0; i <= 1; i++) {
    let tripDay = departureTime.clone().add(-i, 'days')
    let departureTimeMinutes = scheduledDepartureTimeMinutes + 1440 * i

    if (variance) {
      departureTimeMinutes = {
        $gte: departureTimeMinutes - variance,
        $lte: departureTimeMinutes + variance
      }
    }

    query = {
      operationDays: utils.getYYYYMMDD(tripDay),
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
    } else if (routeNumber) {
      query.routeNumber = routeNumber
    }

    if (tripID && !tripID.match(/^\d+$/)) {
      let tripIDQuery = {
        operationDays: utils.getYYYYMMDD(tripDay),
        mode,
        tripID
      }

      let timetable = await db.getCollection('live timetables').findDocument(tripIDQuery)
      || await db.getCollection('gtfs timetables').findDocument(tripIDQuery)
      if (timetable) {
        trip = timetable
        break
      }
    }

    // for the coaches
    let timetable = await db.getCollection('live timetables').findDocument(query)
      || await db.getCollection('gtfs timetables').findDocument(query)

    if (timetable) {
      trip = timetable
      break
    }
  }

  if (!trip) {
    if (mode !== 'regional coach' && !silent)
      global.loggers.general.err('Failed to find timetable:', JSON.stringify(query, null, 1))
    return null
  }
  return trip
}

async function getScheduledDepartures(stopGTFSIDs, db, mode, timeout, useLive, time) {
  let timetables = db.getCollection((useLive ? 'live' : 'gtfs') + ' timetables')
  let routes = db.getCollection('routes')

  if (!time) time = utils.now()
  let minutesPastMidnight = utils.getMinutesPastMidnight(time)
  let operationDay = utils.getYYYYMMDD(time)
  let operationMoment = time.clone()

  if (minutesPastMidnight < 180) { // Before 3am
    minutesPastMidnight += 1440
    operationDay = utils.getYYYYMMDD(operationMoment.add(-1, 'day'))
  }

  let trips = await timetables.findDocuments({
    operationDays: operationDay,
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
    let departureTime = utils.getMomentFromMinutesPastMidnight(stopData.departureTimeMinutes, operationMoment)

    let route = routeCache[trip.routeGTFSID]
    let operator, routeNumber

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

    let firstStop = trip.stopTimings[0]
    let currentStop = trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
    let minutesDiff = currentStop.departureTimeMinutes - firstStop.departureTimeMinutes
    let originDepartureTime = departureTime.clone().add(-minutesDiff, 'minutes')

    return {
      trip,
      scheduledDepartureTime: departureTime,
      originDepartureTime,
      estimatedDepartureTime: currentStop.estimatedDepartureTime,
      actualDepartureTime: currentStop.estimatedDepartureTime || departureTime,
      scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
      destination: trip.destination,
      routeNumber,
      sortNumber,
      operator,
      codedOperator: utils.encodeName(operator),
      loopDirection,
      stopGTFSID: currentStop.stopGTFSID,
      operationDay
    }
  }).filter(Boolean).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

export default {
  getUniqueGTFSIDs,
  getScheduledDepartures,
  getDeparture,
  getStop
}
