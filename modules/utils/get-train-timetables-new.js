const async = require('async')
const utils = require('../../utils')
const { getDayOfWeek } = require('../../public-holidays')

const routeGTFSIDs = require('../../additional-data/metro-route-gtfs-ids')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

let trackGroups = {
  Lilydale: 'Ringwood',
  Belgrave: 'Ringwood',
  Pakenham: 'Dandenong',
  Cranbourne: 'Dandenong',
  Frankston: 'Frankston',
  'Stony Point': 'Frankston',
  Sandringham: 'Sandringham',
  Mernda: 'Clifton Hill',
  Hurstbridge: 'Clifton Hill',
  Werribee: 'Newport',
  Williamstown: 'Newport',
  Craigieburn: 'Craigieburn',
  Sunbury: 'Sunbury',
  Upfield: 'Upfield',
  Alamein: 'Alamein',
  'Glen Waverley': 'Glen Waverley',
  'Flemington Racecourse': 'Flemington Racecourse',
  'City Circle': 'Clifton Hill'
}


function trimFromFSS(trip) {
  let stops = trip.stopTimings.map(stop => stop.stopName)
  let fssIndex = stops.indexOf('Flinders Street Railway Station')
  if (fssIndex >= 0) {
    if (trip.direction === 'Down') return stops.slice(fssIndex)
    else return stops.slice(0, fssIndex)
  } else return stops
}

async function getDeparture(data, db, live) {
  let {
    stopGTFSID,
    possibleLines,
    originalLine,
    departureTime,
    possibleDestinations,
    direction,
    viaCityLoop
  } = data

  let collection = db.getCollection(live ? 'live timetables' : 'gtfs timetables')

  let seen = []
  let allTimetables = []
  let possibleRouteGTFSIDs = possibleLines.map(line => routeGTFSIDs[line])

  let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)

  let iterations = 0
  // Only check past day if 1.5hr before midnight or 5hr after midnight (for NN to capture next day trip)
  if (Math.abs(1440 - scheduledDepartureTimeMinutes) < 90 || scheduledDepartureTimeMinutes < 300) iterations = 1

  for (let i = 0; i <= iterations; i++) {
    let day = departureTime.clone().add(-i, 'days')

    let query = collection.findDocuments({
      _id: {
        $not: {
          $in: seen
        }
      },
      routeGTFSID: {
        $in: possibleRouteGTFSIDs
      },
      destination: {
        $in: possibleDestinations
      },
      operationDays: utils.getYYYYMMDD(day),
      mode: 'metro train',
      stopTimings: {
        $elemMatch: {
          stopGTFSID,
          departureTimeMinutes: scheduledDepartureTimeMinutes + 1440 * i
        }
      },
      // direction
    })

    let timetables = await query.limit(3).toArray()

    if (viaCityLoop !== null) {
      let filteredTimetables = timetables.filter(trip => {
        let stops = trimFromFSS(trip)
        if (stops.includes('Flinders Street Railway Station')) {
          return viaCityLoop === stops.includes('Flagstaff Railway Station')
        } else {
          return true
        }
      })

      if (!(filteredTimetables.length === 0 && timetables.length === 1)) {
        timetables = filteredTimetables
      }
    }

    seen = seen.concat(timetables.map(e => e._id))
    allTimetables.push(timetables)
  }

  let mergedTimetables = allTimetables.reduce((a, e) => a.concat(e), [])
  let originalLineMatch = mergedTimetables.find(timetable => timetable.routeName === originalLine)
  return originalLineMatch || mergedTimetables[0]
}

function getScheduledDeparture(data, db) {
  return getDeparture(data, db, false)
}

function getLiveDeparture(data, db) {
  return getDeparture(data, db, true)
}

async function getScheduledDepartures(station, db, mode, time, timeout, backwards=false) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
  let staticTimetables = db.getCollection('timetables')

  let minutesPastMidnight = utils.getMinutesPastMidnight(time)

  let stopGTFSIDs = station.bays.filter(bay => bay.mode === mode).map(bay => bay.stopGTFSID)

  let gtfsDepartures = []
  let liveDepartures = []
  let startOfDay = time.clone().startOf('day')

  let days = {}
  let stationName = station.stopName.slice(0, -16)
  let isCity = stationName === 'Flinders Street' || cityLoopStations.includes(stationName)

  function getID(trip) {
    if (!trip.isRailReplacementBus && trip.runID) return trip.runID

    if (isCity) {
      return trip.direction + trip.routeGTFSID + trip.origin + trip.destination + trip.destinationArrivalTime
    } else {
      let stop = trip.stopTimings.find(s => stopGTFSIDs.includes(s.stopGTFSID))
      if (trip.mode === 'metro train') {
        let trackGroup = trackGroups[trip.routeName]
        return stop.departureTime + trip.direction + trip.destination + trackGroup
      } else {
        return stop.departureTime + trip.direction + trip.destination
      }
    }
  }

  for (let i = 0; i <= 1; i++) {
    let day = startOfDay.clone().add(-i, 'days')

    let departureTimeMinutes = (minutesPastMidnight % 1440) + 1440 * i

    let departureTime = backwards ? {
      $gte: departureTimeMinutes - timeout,
      $lte: departureTimeMinutes
    } : {
      $gte: departureTimeMinutes - 5,
      $lte: departureTimeMinutes + timeout
    }

    let query = {
      operationDays: utils.getYYYYMMDD(day),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: {
            $in: stopGTFSIDs
          },
          departureTimeMinutes: departureTime
        }
      }
    }

    let gtfsTimetablesFound = await gtfsTimetables.findDocuments(query).toArray()
    let liveTimetablesFound = (await liveTimetables.findDocuments(query).toArray()).filter(timetable => {
      if (timetable.destination === station.stopName) {
        return timetable.trueOrigin === station.stopName
      } else return true
    })

    liveTimetablesFound.concat(gtfsTimetablesFound).forEach(t => {
      days[getID(t)] = day
    })

    gtfsDepartures = gtfsDepartures.concat(gtfsTimetablesFound)
    liveDepartures = liveDepartures.concat(liveTimetablesFound)
  }

  let serviceIndex = []
  let departures = []

  // liveDepartures.forEach(trip => {
  liveDepartures.concat(gtfsDepartures).forEach(trip => {
    let id = getID(trip)
    if (!serviceIndex.includes(id)) {
      serviceIndex.push(id)
      departures.push(trip)
    }
  })

  let timeMS = +time
  let timeoutMS = timeout * 60 * 1000

  let actualDepartureTimeMS = backwards ? {
    $gte: timeMS - timeoutMS,
    $lte: timeoutMS
  } : {
    $gte: timeMS - 1000 * 60,
    $lte: timeMS + timeoutMS
  }

  let lateDepartures = await liveTimetables.findDocuments({
    _id: {
      $not: {
        $in: liveDepartures.map(trip => trip._id)
      }
    },
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        actualDepartureTimeMS
      }
    },
    destination: {
      $ne: station.stopName
    }
  }).toArray()

  lateDepartures.forEach(departure => {
    days[getID(departure)] = utils.parseDate(departure.operationDays)
  })

  return (await async.map(departures.concat(lateDepartures), async trip => {
    let stopData = trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
    let scheduledDepartureTime = utils.getMomentFromMinutesPastMidnight(stopData.departureTimeMinutes, days[getID(trip)])

    let estimatedDepartureTime = stopData.estimatedDepartureTime || null
    if (estimatedDepartureTime) {
      estimatedDepartureTime = utils.parseTime(estimatedDepartureTime)
      let timeDifference = estimatedDepartureTime.diff(time, 'minutes')

      if (backwards && timeDifference > 1) return null
      if (!backwards && timeDifference < -1) return null
    }

    let destination = trip.destination.slice(0, -16)
    let platform = stopData.platform || '??'
    let tripDepartureDay = days[getID(trip)]

    if (!stopData.platform) {
      let day = await getDayOfWeek(tripDepartureDay)

      let staticTrip = await staticTimetables.findDocument({
        mode: 'metro train',
        operationDays: day,
        routeGTFSID: trip.routeGTFSID,
        origin: trip.trueOrigin,
        destination: trip.destination,
        departureTime: trip.trueDepartureTime,
        'stopTimings.stopName': station.stopName
      })

      if (staticTrip) {
        platform = staticTrip.stopTimings.find(stop => stop.stopName === station.stopName).platform + '?'
        trip.runID = staticTrip.runID
      }
    }

    let firstStop = trip.stopTimings[0]
    let currentStop = trip.stopTimings.find(stop => stop.stopName === station.stopName)
    let minutesDifference = (currentStop.arrivalTimeMinutes || currentStop.departureTimeMinutes) - firstStop.departureTimeMinutes
    let originDepartureTime = scheduledDepartureTime.clone().add(-minutesDifference, 'minutes')

    let tripDeparturePTDay = tripDepartureDay.clone()
    if (firstStop.departureTimeMinutes < 180) tripDeparturePTDay.add(-1, 'day')

    return {
      scheduledDepartureTime,
      estimatedDepartureTime,
      actualDepartureTime: estimatedDepartureTime || scheduledDepartureTime,
      fleetNumber: null,
      runID: trip.runID || null,
      ptvRunID: null,
      platform,
      cancelled: trip.cancelled,
      routeName: trip.routeName,
      codedRouteName: utils.encodeName(trip.routeName),
      trip,
      destination,
      direction: trip.direction,
      runDestination: destination,
      viaCityLoop: null,
      viaAltonaLoop: null,
      isRailReplacementBus: trip.isRailReplacementBus,
      suspension: null,
      isSkippingLoop: null,
      originDepartureTime,
      departureDay: utils.getYYYYMMDD(tripDepartureDay),
      trueDepartureDay: utils.getYYYYMMDD(tripDeparturePTDay),
      trueDepartureDayMoment: tripDeparturePTDay
    }
  })).filter(Boolean).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

let filterStops = [...cityLoopStations, 'Flinders Street', 'Richmond', 'North Melbourne', 'Jolimont']
let stopCodes = {
  'Flinders Street': 'FSS',
  'Southern Cross': 'SSS',
  'Flagstaff': 'FGS',
  'Melbourne Central': 'MCE',
  'Parliament': 'PAR',
  'Richmond': 'RMD',
  'Jolimont': 'JLI',
  'North Melbourne': 'NME'
}

let lineGroups = {
  'Cranbourne': 'CFD',
  'Pakenham': 'CFD',
  'Sandringham': 'CFD',

  'Glen Waverley': 'BLY',
  'Lilydale': 'BLY',
  'Belgrave': 'BLY',
  'Alamein': 'BLY',

  'Hurstbridge': 'CHL',
  'Mernda': 'CHL',

  'Frankston': 'CCY',
  'Williamstown': 'CCY',
  'Werribee': 'CCY',

  'Upfield': 'NOR',
  'Sunbury': 'NOR',
  'Craigieburn': 'NOR',
  'Flemington Racecourse': 'NOR',
}

async function getConsist(runID, departureDate, db) {
  let metroTrips = db.getCollection('metro trips')

  let consist = await metroTrips.findDocument({
    date: departureDate,
    runID
  })

  if (consist) return consist.consist
  return null
}

async function getScheduledMetroDepartures(station, db, time, backwards=false) {
  let departures = await getScheduledDepartures(station, db, 'metro train', time, 90, backwards)
  let stopName = station.stopName.slice(0, -16)
  let stopCode = stopCodes[stopName]
  let isInCity = cityLoopStations.includes(stopName) || stopName === 'Flinders Street'

  return (await async.map(departures, async departure => {
    let tripStops = departure.trip.stopTimings
    let currentIndex = tripStops.findIndex(stop => stop.stopName === station.stopName)
    let stopNames = tripStops.map(stop => stop.stopName.slice(0, -16))
    let futureStops = stopNames.slice(currentIndex + 1)

    departure.allStops = stopNames
    departure.futureStops = futureStops

    let cityLoopRunning = stopNames.filter(stop => filterStops.includes(stop)).map(stop => stopCodes[stop])
    let willGoByCityLoop = cityLoopRunning.includes('MCE')

    if (departure.trip.direction === 'Up') {
      departure.destination = departure.trip.destination.slice(0, -16)

      if (departure.destination === 'Flinders Street') {
        if (willGoByCityLoop) cityLoopRunning.shift()
        let viaCityLoop = cityLoopRunning[0] === 'FGS' || cityLoopRunning[0] === 'PAR'

        if (viaCityLoop && !isInCity) {
          departure.destination = 'City Loop'
        }

        departure.cityLoopRunning = cityLoopRunning
      }
    } else if (isInCity) {
      let currentIndex = cityLoopRunning.indexOf(stopCode)
      let upcoming = cityLoopRunning.slice(currentIndex)
      let viaCityLoop = upcoming.includes('FGS')

      if (viaCityLoop) {
        cityLoopRunning.pop()
      } else {
        let sssIndex = upcoming.indexOf('SSS')
        if (sssIndex !== -1 && sssIndex > currentIndex) cityLoopRunning = ['FSS', 'SSS', 'NME']
        else cityLoopRunning = cityLoopRunning.slice(-2)
      }

      departure.cityLoopRunning = cityLoopRunning

      let depTime = departure.departureTime
      let destStopIndex = utils.findLastIndex(departure.trip.stopTimings, stop => stop.stopName === departure.trip.trueDestination)
      let destArrMin = departure.trip.stopTimings[destStopIndex].arrivalTimeMinutes
      let destArr = departure.trueDepartureDayMoment.clone().add(destArrMin, 'minutes')
      if (depTime >= destArr) return null
    }

    let altonaLoopRunning = []
    if (departure.trip.routeName === 'Werribee') {
      let stopsNPTLAV = stopNames.includes('Newport') && stopNames.includes('Laverton')
      if (stopsNPTLAV) {
        departure.viaAltonaLoop = stopNames.includes('Altona')
        if (departure.viaAltonaLoop) { // Via ALT Loop
          altonaLoopRunning = ['WTO', 'ALT', 'SHE']
        } else { // Via ML
          altonaLoopRunning = ['LAV', 'NPT']
        }

        if (departure.trip.direction === 'Down') altonaLoopRunning.reverse()
      }
    }

    departure.altonaLoopRunning = altonaLoopRunning

    if (departure.trip.routeGTFSID === '2-CCL')
      departure.destination = 'City Circle'

    if (departure.runID && !departure.isRailReplacementBus) {
      departure.fleetNumber = await getConsist(departure.runID, departure.trueDepartureDay, db)
    }

    return departure
  })).filter(Boolean)
}

module.exports = {
  getLiveDeparture,
  getScheduledDeparture,
  getScheduledDepartures,
  getScheduledMetroDepartures
}
