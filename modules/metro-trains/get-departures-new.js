const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const findConsist = require('./fleet-parser')
const departureUtils = require('../utils/get-train-timetables-new')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const { getDayOfWeek } = require('../../public-holidays')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']
let cityStations = [...cityLoopStations, 'Flinders Street']

let burnleyGroup = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
let caulfieldGroup = ['Frankston', 'Cranbourne', 'Pakenham', 'Sandringham']
let dandenongGroup = ['Cranbourne', 'Pakenham']
let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington', 'Werribee', 'Williamstown']
let cliftonHillGroup = ['Mernda', 'Hurstbridge']
let genericGroup = ['City Circle', 'Stony Point']

let lineGroups = [
  burnleyGroup, caulfieldGroup,
  northernGroup, cliftonHillGroup,
  genericGroup
]

function addCityLoopRunning(train) {
  let { routeName, viaCityLoop, runDestination, runID } = train
  let loopRunning = []

  if (northernGroup.includes(routeName)) {
    if (viaCityLoop) {
      loopRunning = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
    } else {
      if (runDestination === 'Southern Cross') {
        loopRunning = ['NME', 'SSS']
      } else if (runDestination === 'Flagstaff') {
        loopRunning = ['SSS', 'FSS', 'PAR', 'MCE', 'FGS']
      } else {
        loopRunning = ['NME', 'SSS', 'FSS']
      }
    }
  } else if (cliftonHillGroup.includes(routeName)) {
    if (viaCityLoop) {
      loopRunning = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    } else {
      if (runDestination === 'Parliament') {
        loopRunning = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
      } else {
        loopRunning = ['JLI', 'FSS']
      }
    }
  } else if (burnleyGroup.includes(routeName) || caulfieldGroup.includes(routeName)) {
    if (viaCityLoop) {
      loopRunning = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    } else {
      if (runDestination === 'Southern Cross') {
        loopRunning = ['RMD', 'FSS', 'SSS']
      } else if (runDestination === 'Parliament') {
        loopRunning = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
      } else {
        loopRunning = ['RMD', 'FSS']
      }
    }
  }

  if (routeName === 'City Circle') {
    if (700 <= runID && runID <= 799) loopRunning = ['FSS', 'PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    if (800 <= runID && runID <= 899) loopRunning = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR', 'FSS']
  } else if (train.direction === 'Down') loopRunning.reverse()

  train.cityLoopRunning = loopRunning
}

function addAltonaLoopRunning(train) {
  let stops = train.allStops
  let stopsNPTLAV = stops.includes('Newport') && stops.includes('Laverton')
  let loopRunning = []

  if (stopsNPTLAV) {
    if (stops.includes('Altona')) { // Via ALT Loop
      loopRunning = ['WTO', 'ALT', 'SHE']
    } else { // Via ML
      loopRunning = ['LAV', 'NPT']
    }

    if (train.direction === 'Down') loopRunning.reverse()
    train.altonaLoopRunning = loopRunning
  }
}

function filterDepartures(departures, filter) {
  if (filter) {
    let now = utils.now()
    departures = departures.filter(departure => {
      let secondsDiff = departure.actualDepartureTime.diff(now, 'seconds')

      return -30 < secondsDiff && secondsDiff < 5400 // 1.5 hours
    })
  }

  return departures.sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime || a.destination.localeCompare(b.destination)
  })
}

async function matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations) {
  let fullPossibleDestinations = possibleDestinations.map(dest => dest + ' Railway Station')

  let data = {
    stopGTFSID,
    possibleLines,
    departureTime: train.scheduledDepartureTime,
    possibleDestinations: fullPossibleDestinations,
    direction: train.direction,
    viaCityLoop: train.viaCityLoop
  }

  return await departureUtils.getLiveDeparture(data, db)
    || await departureUtils.getScheduledDeparture(data, db)
}

async function genericMatch(train, stopGTFSID, db) {
  let possibleLines = lineGroups.find(group => group.includes(train.routeName)) || train.routeName

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Parliament') // RMD/JLI -> FSS -> CCL -> PAR
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flinders Street' && !train.viaCityLoop)
    possibleDestinations.push('Parliament')

  let trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)
  return trip
}

async function cfdGroupMatch(train, stopGTFSID, db) {
  let possibleLines = caulfieldGroup

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Parliament') // RMD -> FSS -> CCL -> PAR
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Southern Cross' && !train.viaCityLoop) // RMD -> FSS -> SSS -> NPT (Occo Only)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flagstaff' && train.viaCityLoop) // RMD -> CCL -> FSS -> PAR -> CCL -> FGS -> NME
    possibleDestinations.push('Flinders Street')

  let trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)
  return trip
}

async function norGroupMatch(train, stopGTFSID, db) {
  let possibleLines = northernGroup

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Southern Cross' && train.viaCityLoop) // NME -> FGS -> CCL -> FSS -> SSS -> NME (Next trip)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flagstaff' && !train.viaCityLoop) // NME -> SSS -> FSS -> CCL -> FGS -> NME (Next trip)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flinders Street') {
    if (train.viaCityLoop) {
      possibleDestinations.push('Southern Cross')
    } else {// NME -> SSS -> FSS -> CCL -> FGS -> NME (Next trip)
      possibleDestinations.push('Flagstaff')
    }
  }

  let trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)
  return trip
}

async function verifyTrainLoopRunning(train) {
  if (dandenongGroup.includes(train.routeName)) {
    let departureDay = await getDayOfWeek(train.originDepartureTime)
    if (train.runID <= 4299) {
      if (departureDay === 'Sat' || departureDay === 'Sun') {
        train.viaCityLoop = false
      } else {
        let fssIndex = train.futureStops.indexOf('Flinders Street')
        if (train.direction === 'Up' && fssIndex !== -1) {
          train.viaCityLoop = train.futureStops.includes('Parliament')
        }
      }
    } else if (6999 < train.runID && train.runID < 7999) {
      let loopIndicator = train.runID[1]
      train.viaCityLoop = loopIndicator > 5
    }
  }
}

async function mapTrain(train, metroPlatform, db) {
  let {stopGTFSID} = metroPlatform
  let stationName = metroPlatform.fullStopName.slice(0, -16)
  let isInLoop = cityLoopStations.includes(stationName)

  let routeName = train.routeName
  let trip
  if (burnleyGroup.includes(routeName) || cliftonHillGroup.includes(routeName) || genericGroup.includes(routeName)) {
    trip = await genericMatch(train, stopGTFSID, db)
  } else if (caulfieldGroup.includes(routeName)) {
    trip = await cfdGroupMatch(train, stopGTFSID, db)
  } else if (northernGroup.includes(routeName)) {
    trip = await norGroupMatch(train, stopGTFSID, db)
  }

  if (!trip) {
    // Rewrite specifically for metro
    trip = await getStoppingPattern(db, train.ptvRunID, 'metro train', train.scheduledDepartureTime.toISOString())
  }

  let destination = trip.trueDestination.slice(0, -16)

  return {
    scheduledDepartureTime: train.scheduledDepartureTime,
    estimatedDepartureTime: train.estimatedDepartureTime,
    actualDepartureTime: train.estimatedDepartureTime || train.scheduledDepartureTime,
    fleetNumber: train.fleetNumber,
    runID: train.runID,
    platform: train.platform,
    cancelled: train.cancelled,
    routeName: train.routeName,
    codedRouteName: utils.encodeName(train.routeName),
    trip,
    destination,
    direction: train.direction,
    runDestination: train.runDestination,
    viaCityLoop: train.viaCityLoop,
    isRailReplacementBus: false
  }
}

function determineLoopRunning(runID, routeName, direction) {
  let viaCityLoop
  let loopIndicator = runID[1]

  if (dandenongGroup.includes(routeName)) {
    if (3999 < runID && runID < 4105) {
      viaCityLoop = direction === 'Up'
    } else if (4179 < runID && runID < 4200) { // Night network, loop closed
      viaCityLoop = false
    } else if (runID < 4265) {
      viaCityLoop = direction === 'Up'
    } else if (4599 < runID && runID < 4800) {
      viaCityLoop = direction === 'Up'
    }
  } else {
    viaCityLoop = loopIndicator > 5
  }

  return viaCityLoop
}

function appendDepartureDay(departure, stopGTFSID) {
  let { trip } = departure
  let stopData = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
  if (!stopData) return global.loggers.general.warn('No departure day', departure, stopGTFSID)

  let firstStop = trip.stopTimings[0]
  let fssStop = trip.stopTimings.find(tripStop => tripStop.stopName === 'Flinders Street Railway Station')
  if (trip.direction === 'Down' && fssStop) firstStop = fssStop

  let originDepartureMinutes = firstStop.departureTimeMinutes
  let stopDepartureMinutes = stopData.departureTimeMinutes || stopData.arrivalTimeMinutes
  let minutesDiff = stopDepartureMinutes - originDepartureMinutes
  let originDepartureTime = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

  departure.originDepartureTime = originDepartureTime
  departure.departureDay = utils.getYYYYMMDD(originDepartureTime)
  departure.trackerDay = departure.departureDay
  if (originDepartureMinutes >= 1440) {
    departure.trackerDay = utils.getYYYYMMDD(originDepartureTime.clone().add(-1, 'day'))
  }
}

function findUpcomingStops(departure, stopGTFSID) {
  let tripStops = departure.trip.stopTimings
  let currentIndex = tripStops.findIndex(stop => stop.stopGTFSID === stopGTFSID)
  let stopNames = tripStops.map(stop => stop.stopName.slice(0, -16))
  let futureStops = stopNames.slice(currentIndex + 1)

  departure.allStops = stopNames
  departure.futureStops = futureStops
}


async function saveConsists(departures, db) {
  let metroTrips = db.getCollection('metro trips')
  let runIDsSeen = []
  let deduped = departures.filter(dep => {
    if (!runIDsSeen.includes(dep.runID)) {
      runIDsSeen.push(dep.runID)
      return true
    } else {
      return false
    }
  })

  await async.forEach(deduped, async departure => {
    if (!departure.fleetNumber) return

    let query = {
      date: departure.trackerDay,
      runID: departure.runID
    }

    let tripData = {
      ...query,
      origin: departure.trip.trueOrigin.slice(0, -16),
      destination: departure.trip.trueDestination.slice(0, -16),
      departureTime: departure.trip.trueDepartureTime,
      destinationArrivalTime: departure.trip.trueDestinationArrivalTime,
      consist: departure.fleetNumber
    }

    await metroTrips.replaceDocument(query, tripData, {
      upsert: true
    })
  })
}

async function getDeparturesFromPTV(station, db) {
  let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
  let stationName = metroPlatform.fullStopName.slice(0, -16)

  let url = `/v3/departures/route_type/0/stop/${metroPlatform.stopGTFSID}?gtfs=true&max_results=12&include_cancelled=true&expand=Direction&expand=Run&expand=Route&expand=VehicleDescriptor`
  let {departures, runs, routes, directions} = await ptvAPI(url)
  let now = utils.now()

  let parsedDepartures = departures.map(departure => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

    if (scheduledDepartureTime.diff(now, 'minutes') > 110) return null

    let platform = departure.platform_number
    let ptvRunID = departure.run_ref

    let run = runs[ptvRunID]
    let route = routes[departure.route_id]
    let directionData = directions[departure.direction_id]

    let cancelled = run.status === 'cancelled'
    let vehicleDescriptor = run.vehicle_descriptor || {}
    let isRailReplacementBus = departure.flags.includes('RRB-RUN')

    let fleetNumber = null
    if (!isRailReplacementBus) {
      if (vehicleDescriptor) {
        fleetNumber = findConsist(vehicleDescriptor.id)
      }
    }

    let routeName = route.route_name
    if (routeName.includes('Showgrounds')) routeName = 'Showgrounds/Flemington'
    if (route.route_id === 99) routeName = 'City Circle'
    let runDestination = run.destination_name.trim()

    let direction = directionData.direction_name.includes('City') ? 'Up' : 'Down'
    if (routeName === 'Stony Point') direction = runDestination === 'Frankston' ? 'Up' : 'Down'
    if (routeName === 'City Circle') direction = 'Down'

    let viaCityLoop = null
    let runID = null
    if (ptvRunID > 948000) {
      runID = utils.getRunID(ptvRunID)
      viaCityLoop = determineLoopRunning(runID, routeName, direction)
    }

    return {
      scheduledDepartureTime,
      estimatedDepartureTime,
      platform,
      cancelled,
      fleetNumber,
      isRailReplacementBus,
      routeName,
      runDestination,
      ptvRunID,
      runID,
      direction,
      viaCityLoop
    }
  }).filter(Boolean)

  let replacementBuses = parsedDepartures.filter(departure => departure.isRailReplacementBus)
  let trains = parsedDepartures.filter(departure => !departure.isRailReplacementBus)

  let mappedTrains = await async.map(trains, async train => await mapTrain(train, metroPlatform, db))

  let allDepartures = [...mappedTrains].sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  allDepartures.forEach(departure => {
    appendDepartureDay(departure, metroPlatform.stopGTFSID)
    findUpcomingStops(departure, metroPlatform.stopGTFSID)
  })

  await saveConsists(mappedTrains, db)
  await async.forEach(mappedTrains, async train => {
    await verifyTrainLoopRunning(train)

    if (train.destination === 'Flinders Street' && train.viaCityLoop && !cityStations.includes(stationName)) {
      train.destination = 'City Loop'
    }

    if (train.routeName === 'City Circle' && stationName === 'Flinders Street') {
      train.destination = 'City Circle'
    }

    let isCityTrain = [
      train.trip.trueOrigin.slice(0, -16),
      train.trip.trueDestination.slice(0, -16)
    ].some(stop => cityStations.includes(stop))

    if (isCityTrain) addCityLoopRunning(train)
    if (train.routeName === 'Werribee') addAltonaLoopRunning(train)
  })


  return allDepartures
}

async function getDepartures(station, db, filter) {
  try {
    if (typeof filter === 'undefined') filter = true

    return await utils.getData('metro-departures-new', station.stopName, async () => {
      let departures = await getDeparturesFromPTV(station, db)

      return filterDepartures(departures, filter)
    })
  } catch (e) {
    global.loggers.general.err('Error getting Metro departures', e)
    try {
      return await departureUtils.getScheduledMetroDepartures(station, db)
    } catch (ee) {
      global.loggers.general.err('Error getting Scheduled Metro departures', ee)
      return null
    }
  }
}

module.exports = getDepartures
