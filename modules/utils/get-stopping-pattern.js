const async = require('async')
const moment = require('moment')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const nameModifier = require('../../additional-data/stop-name-modifier')
const metroTypes = require('../../additional-data/metro-tracker/metro-types')

const fixTripDestination = require('../metro-trains/fix-trip-destinations')

let modes = {
  'metro train': 0,
  'regional train': 3,
  'regional coach': 3,
  'bus': 2,
  'nbus': 4,
  'tram': 1
}

module.exports = async function (db, ptvRunID, mode, time, stopID, referenceTrip, extraTripData) {
  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')
  let routesCollection = db.getCollection('routes')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/${modes[mode]}?expand=stop&expand=run&expand=route&expand=direction&expand=VehicleDescriptor`
  if (time)
    url += `&date_utc=${time}`
  if (stopID)
    url += `&stop_id=${stopID}`

  let {departures, stops, runs, routes, directions} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  let ptvDirection = Object.values(directions)[0]
  let routeData = Object.values(routes)[0]

  let trueMode = mode

  if (mode === 'nbus') mode = 'bus'

  departures = departures.map(departure => {
    departure.actualDepartureTime = utils.parseTime(departure.estimated_departure_utc || departure.scheduled_departure_utc)
    departure.scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    departure.estimatedDepartureTime = utils.parseTime(departure.estimated_departure_utc)
    return departure
  })

  let dbStops = {}
  let checkModes = [mode]
  if (mode === 'regional coach') checkModes.push('regional train')

  let routeGTFSID = routeData.route_gtfs_id
  if (mode === 'tram') routeGTFSID = `3-${parseInt(routeGTFSID.slice(2))}`
  if (routeData.route_id === 99) routeGTFSID = '2-CCL'
  let route = await routesCollection.findDocument({ routeGTFSID })

  let directionName = ptvDirection.direction_name
  let gtfsDirection = route.ptvDirections[directionName]

  if (mode === 'tram') {
    let keys = Object.keys(route.ptvDirections)
    let bestKey = keys.find(k => k.replace(/[\w ]+ to/).includes(directionName))
    if (bestKey) gtfsDirection = route.ptvDirections[bestKey]
  }


  let previousDepartureTime = -1

  await async.forEachSeries(Object.values(stops), async stop => {
    let stopName = stop.stop_name.trim()
    if (mode === 'metro train') {
      if (stopName === 'Jolimont-MCG')
        stopName = 'Jolimont'

      stopName += ' Railway Station'
    }

    stopName = utils.getProperStopName(stopName)

    let dbStop = await stopsCollection.findDocument({
      $or: [{
        'bays.fullStopName': stopName
      }, {
        stopName,
      }],
      'bays.mode': { $in: checkModes }
    })
    if (!dbStop) console.log(stopName)
    dbStops[stop.stop_id] = dbStop
  })

  let tripOperationDay

  let stopTimings = departures.map((departure, i) => {
    let {
      estimatedDepartureTime, scheduledDepartureTime,
      stop_id, platform_number
    } = departure

    if (i === 0) {
      tripOperationDay = utils.getYYYYMMDD(scheduledDepartureTime)
    }

    let ptvStop = stops[stop_id]

    let stopBay = dbStops[stop_id].bays
      .filter(bay => {
        let stopName = utils.getProperStopName(ptvStop.stop_name)
        let matchingService = bay.services.find(s => s.routeGTFSID === routeGTFSID && s.gtfsDirection === gtfsDirection)

        return checkModes.includes(bay.mode) && bay.fullStopName === stopName && matchingService
      })[0]
    if (!stopBay) {
      stopBay = dbStops[stop_id].bays
        .filter(bay => checkModes.includes(bay.mode))[0]
    }

    let departureTimeMinutes = utils.getMinutesPastMidnight(scheduledDepartureTime)

    if (previousDepartureTime == -1) { // if first stop is already beyond midnight then keep it
      if (trueMode === 'nbus' && departureTimeMinutes < 600) {
        arrivalTimeMinutes %= 1440
        departureTimeMinutes %= 1440
      }
    } else {
      departureTimeMinutes %= 1440
    }

    if (departureTimeMinutes < previousDepartureTime)
      departureTimeMinutes += 1440

    previousDepartureTime = departureTimeMinutes

    let stopTiming = {
      stopName: stopBay.fullStopName,
      stopNumber: stopBay.stopNumber,
      suburb: stopBay.suburb,
      stopGTFSID: stopBay.stopGTFSID,
      arrivalTime: scheduledDepartureTime.format("HH:mm"),
      arrivalTimeMinutes: departureTimeMinutes,
      departureTime: scheduledDepartureTime.format("HH:mm"),
      departureTimeMinutes,
      estimatedDepartureTime: estimatedDepartureTime ? estimatedDepartureTime.toISOString() : null,
      platform: platform_number,
      stopConditions: {
        pickup: departure.flags.includes('DOO') ? 1 : 0, // if dropoff onliy then pickup is unavailable
        dropoff: departure.flags.includes('PUO') ? 1 : 0
      }
    }

    if (i == 0) {
      stopTiming.arrivalTime = null
      stopTiming.arrivalTimeMinutes = null
    } else if (i == departures.length - 1) {
      stopTiming.departureTime = null
      stopTiming.departureTimeMinutes = null
    }

    return stopTiming
  })

  let vehicleDescriptor = run.vehicle_descriptor || {}

  if (mode === 'regional coach')
    routeGTFSID = '5-' + routeGTFSID.slice(2)

  let direction
  if (mode === 'metro train') {
    direction = ptvDirection.direction_id === 1 ? 'Up' : 'Down'
    if (routeGTFSID === '2-CCL') direction = 'Down'
  }

  let routeName = route.routeName

  let cancelled
  if (mode === 'metro train') {
    cancelled = run.status === 'cancelled'
  }

  let runID = vehicleDescriptor.id
  let vehicle = vehicleDescriptor.description || vehicleDescriptor.id
  if (mode === 'metro train') {
    if (['Belgrave', 'Lilydale', 'Alamein', 'Glen Waverley'].includes(routeName) && vehicle) {
      vehicle = vehicle.replace('Comeng', 'Xtrapolis')
    }
    runID = utils.getRunID(ptvRunID)

    let metroTrips = db.getCollection('metro trips')
    let tripData = await metroTrips.findDocument({
      date: tripOperationDay,
      runID
    })

    if (tripData && vehicle) {
      let ptvConsistSize = vehicle.slice(0, 1)
      let carType = metroTypes.find(car => tripData.consist.includes(car.leadingCar))
      vehicle = ptvConsistSize + ' Car ' + carType.type
    }
  }


  let timetable = {
    mode, routeName,
    routeGTFSID,
    routeNumber: referenceTrip ? referenceTrip.routeNumber : route.routeNumber,
    routeDetails: referenceTrip ? referenceTrip.routeDetails : null,
    runID,
    operationDays: [tripOperationDay],
    vehicle,
    stopTimings: stopTimings,
    destination: stopTimings[stopTimings.length - 1].stopName,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].arrivalTime,
    departureTime: stopTimings[0].departureTime,
    origin: stopTimings[0].stopName,
    type: "timings",
    updateTime: new Date(),
    gtfsDirection,
    direction,
    cancelled,
    ...extraTripData
  }

  timetable = fixTripDestination(timetable)

  let key = {
    mode, routeName: timetable.routeName,
    operationDays: timetable.operationDays,
    departureTime: timetable.departureTime,
    destinationArrivalTime: timetable.destinationArrivalTime
  }

  await liveTimetables.replaceDocument(key, timetable, {
    upsert: true
  })

  return timetable
}
