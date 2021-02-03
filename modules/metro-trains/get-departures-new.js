const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const findConsist = require('./fleet-parser')
const departureUtils = require('../utils/get-train-timetables-new')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

let burnleyGroup = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
let caulfieldGroup = ['Frankston', 'Cranbourne', 'Pakenham', 'Sandringham']
let dandenongGroup = ['Cranbourne', 'Pakenham']
let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington', 'Werribee', 'Williamstown']
let cliftonHillGroup = ['Mernda', 'Hurstbridge']

let lineGroups = [
  burnleyGroup, caulfieldGroup,
  northernGroup, cliftonHillGroup
]

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

  return await departureUtils.getLiveDeparture(
    stopGTFSID, db, 'metro train', possibleLines,
    train.scheduledDepartureTime,
    fullPossibleDestinations,
    train.direction,
    train.viaCityLoop
  ) || await departureUtils.getScheduledDeparture(
    stopGTFSID, db, 'metro train', possibleLines,
    train.scheduledDepartureTime,
    fullPossibleDestinations,
    train.direction,
    train.viaCityLoop
  )
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

async function mapTrain(train, metroPlatform, db) {
  let {stopGTFSID} = metroPlatform
  let stationName = metroPlatform.fullStopName.slice(0, -16)
  let isInLoop = cityLoopStations.includes(stationName)

  let routeName = train.routeName
  let trip
  if (burnleyGroup.includes(routeName) || cliftonHillGroup.includes(routeName)) {
    trip = await genericMatch(train, stopGTFSID, db)
  } else if (caulfieldGroup.includes(routeName)) {
    trip = await cfdGroupMatch(train, stopGTFSID, db)
  } else if (northernGroup.includes(routeName)) {
    trip = await norGroupMatch(train, stopGTFSID, db)
  }

  if (!trip) console.log(train)
}

async function getDeparturesFromPTV(station, db) {
  let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')

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
      let loopIndicator = ptvRunID[3]
      runID = utils.getRunID(ptvRunID)
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
        viaCityLoop = parseInt(loopIndicator) > 5
      }
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
      direction,
      viaCityLoop
    }
  }).filter(Boolean)

  let replacementBuses = parsedDepartures.filter(departure => departure.isRailReplacementBus)
  let trains = parsedDepartures.filter(departure => !departure.isRailReplacementBus)

  let mappedTrains = await async.map(trains, train => mapTrain(train, metroPlatform, db))

  return mappedTrains
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
