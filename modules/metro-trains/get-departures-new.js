const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const findConsist = require('./fleet-parser')
const departureUtils = require('../utils/get-train-timetables-new')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

let burnleyGroup = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
let caulfieldGroup = ['Cranbourne', 'Pakenham', 'Sandringham']
let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington']
let cliftonHillGroup = ['Mernda', 'Hurstbridge']
let crossCityGroup = ['Frankston', 'Werribee', 'Williamstown']

let lineGroups = [
  burnleyGroup, caulfieldGroup,
  northernGroup, cliftonHillGroup,
  crossCityGroup
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

  let trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)

  console.log(trip)
}

async function mapTrain(train, metroPlatform, db) {
  let {stopGTFSID} = metroPlatform
  let stationName = metroPlatform.fullStopName.slice(0, -16)
  let isInLoop = cityLoopStations.includes(stationName)

  let routeName = train.routeName
  if (burnleyGroup.includes(routeName) || cliftonHillGroup.includes(routeName) || northernGroup.includes(routeName)) {
    let trip = await genericMatch(train, stopGTFSID, db)
  }
}

async function getDeparturesFromPTV(station, db) {
  let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')

  let url = `/v3/departures/route_type/0/stop/${metroPlatform.stopGTFSID}?gtfs=true&max_results=12&include_cancelled=true&expand=Direction&expand=Run&expand=Route&expand=VehicleDescriptor`
  let {departures, runs, routes, directions} = await ptvAPI(url)

  let parsedDepartures = departures.map(departure => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

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
    if (ptvRunID > 948000) {
      let viaCityLoop = ptvRunID[3] >= 5
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
  })

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
