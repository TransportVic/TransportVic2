const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const nameModifier = require('../../additional-data/stop-name-modifier')
const metroTypes = require('../../additional-data/metro-tracker/metro-types')
const gtfsGroups = require('../gtfs-id-groups')
const addStonyPointData = require('../metro-trains/add-stony-point-data')
const determineBusRouteNumber = require('../../additional-data/determine-bus-route-number')
const fixTripDestination = require('../metro-trains/fix-trip-destinations')

let modes = {
  'metro train': 0,
  'regional train': 3,
  'regional coach': 3,
  'bus': 2,
  'nbus': 4,
  'tram': 1
}

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']
let borderStops = ['Richmond', 'Jolimont', 'North Melbourne', 'Flinders Street']

function extendMetroEstimation(trip) {
  let checkStop

  if (trip.direction === 'Up') {
    let borderStop = trip.stopTimings.find(stop => borderStops.includes(stop.stopName.slice(0, -16)))

    if (borderStop) {
      let hasSeenStop = false
      trip.stopTimings.slice(trip.stopTimings.indexOf(borderStop)).forEach(stop => {
        if (stop.estimatedDepartureTime) checkStop = stop
      })
    }
  }

  if (!checkStop) {
    checkStop = trip.stopTimings[trip.stopTimings.length - 2]
  }

  if (checkStop && checkStop.estimatedDepartureTime) {
    let scheduledDepartureTime = utils.parseTime(checkStop.scheduledDepartureTime)
    let estimatedDepartureTime = utils.parseTime(checkStop.estimatedDepartureTime)
    let delay = estimatedDepartureTime - scheduledDepartureTime

    let hasSeenStop = false
    trip.stopTimings = trip.stopTimings.map(stop => {
      if (hasSeenStop && !stop.estimatedDepartureTime) {
        let stopScheduled = utils.parseTime(stop.scheduledDepartureTime)
        let stopEstimated = stopScheduled.clone().add(delay, 'milliseconds')
        stop.estimatedDepartureTime = stopEstimated.toISOString()
        stop.actualDepartureTimeMS = +stopEstimated
      } else if (stop === checkStop) hasSeenStop = true

      return stop
    })
  }

  // Extend estimation backwards to first stop (usually city loop etc)
  let firstStop = trip.stopTimings[0]
  let secondStop = trip.stopTimings[1]
  if (!firstStop.estimatedDepartureTime && secondStop.estimatedDepartureTime) {
    let scheduledDepartureTime = utils.parseTime(firstStop.scheduledDepartureTime)
    let estimatedDepartureTime = utils.parseTime(firstStop.estimatedDepartureTime)
    let delay = estimatedDepartureTime - scheduledDepartureTime

    let secondScheduled = utils.parseTime(secondStop.scheduledDepartureTime)
    let secondEstimated = secondScheduled.clone().add(delay, 'milliseconds')
    secondStop.estimatedDepartureTime = secondEstimated.toISOString()
    secondStop.actualDepartureTimeMS = +secondEstimated
  }

  return trip
}

module.exports = async function (db, ptvRunID, mode, time, stopID, referenceTrip, extraTripData) {
  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')
  let routesCollection = db.getCollection('routes')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/${modes[mode]}?expand=stop&expand=run&expand=route&expand=direction&expand=VehicleDescriptor`
  if (time) {
    if (mode === 'metro train') {
      let startTime = utils.parseTime(time)
      if (utils.getMinutesPastMidnight(startTime) < 180) startTime.add(-3.5, 'hours')
      url += `&date_utc=${startTime.toISOString()}`
    } else {
      url += `&date_utc=${time}`
    }
  }
  if (stopID)
    url += `&stop_id=${stopID}`

  let {departures, stops, runs, routes, directions} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  let ptvDirection = Object.values(directions)[0]
  let routeData = Object.values(routes)[0]

  if (departures.length === 0) return referenceTrip

  if (stopID && time) {
    let checkStop = departures.find(stop => stop.stop_id === stopID)
    if (checkStop && checkStop.scheduled_departure_utc !== time) return referenceTrip
  }

  let trueMode = mode

  if (mode === 'nbus') mode = 'bus'

  departures = departures.map(departure => {
    departure.actualDepartureTime = utils.parseTime(departure.estimated_departure_utc || departure.scheduled_departure_utc)
    departure.scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    departure.estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null
    return departure
  })

  let dbStops = {}
  let checkModes = [mode]
  if (mode === 'regional coach') checkModes.push('regional train')

  let routeGTFSID = routeData.route_gtfs_id
  if (routeGTFSID === '4-965') routeGTFSID = '8-965'

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
    if (!dbStop) global.loggers.general.err('Failed to match stop', stopName)
    dbStops[stop.stop_id] = dbStop
  })

  let tripOperationDay
  let tripStartTime

  let stopTimings = departures.map((departure, i) => {
    let {
      estimatedDepartureTime, scheduledDepartureTime,
      stop_id, platform_number
    } = departure

    if (i === 0) {
      tripOperationDay = utils.getYYYYMMDD(scheduledDepartureTime)
      tripStartTime = scheduledDepartureTime
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
      actualDepartureTimeMS: estimatedDepartureTime ? +estimatedDepartureTime : null,
      scheduledDepartureTime: scheduledDepartureTime.toISOString(),
      platform: platform_number,
      stopConditions: {
        pickup: departure.flags.includes('DOO') ? 1 : 0, // if dropoff only then pickup is unavailable
        dropoff: departure.flags.includes('PUO') ? 1 : 0
      }
    }

    return stopTiming
  })

  let vehicleDescriptor = run.vehicle_descriptor || {}

  if (mode === 'regional coach')
    routeGTFSID = '5-' + routeGTFSID.slice(2)

  let direction
  if (mode === 'metro train') {
    direction = ptvDirection.direction_name.includes('City') ? 'Up' : 'Down'
    if (routeGTFSID === '2-SPT') {
      let origin = stopTimings[0].stopName
      if (origin === 'Frankston Railway Station') direction = 'Down'
      else direction = 'Up'
    }
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
    if (['Belgrave', 'Lilydale', 'Alamein', 'Glen Waverley', 'Hurstbridge', 'Mernda'].includes(routeName) && vehicle) {
      vehicle = vehicle.replace('Comeng', 'Xtrapolis')
    }
    if (['Cranbourne', 'Pakenham', 'Sandringham'].includes(routeName) && vehicle) {
      vehicle = vehicle.replace('Xtrapolis', 'Comeng') // Xtrap sometimes show on CBE PKM SHM so correct to comeng
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
      if (tripData.consist[0].match(/9\d{3}/)) carType = { type: 'HCMT' }
      if (carType) vehicle = ptvConsistSize + ' Car ' + carType.type
    }

    if (referenceTrip && extraTripData && extraTripData.trimStops) {
      let referenceStops = referenceTrip.stopTimings.map(stop => stop.stopName)
      if (referenceStops.includes('Flinders Street')) {
        referenceStops = referenceStops.concat(cityLoopStations)
      }
      stopTimings = stopTimings.filter(stop => referenceStops.includes(stop.stopName))
    }
  }

  stopTimings[0].arrivalTime = null
  stopTimings[0].arrivalTimeMinutes = null
  stopTimings.slice(-1)[0].departureTime = null
  stopTimings.slice(-1)[0].departureTimeMinutes = null

  let routeNumber = referenceTrip ? referenceTrip.routeNumber : route.routeNumber

  let timetable = {
    mode, routeName,
    routeGTFSID,
    routeNumber,
    routeDetails: referenceTrip ? referenceTrip.routeDetails : null,
    runID,
    operationDays: tripOperationDay,
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

  if (mode === 'bus') timetable.routeNumber = determineBusRouteNumber(timetable)

  timetable = fixTripDestination(timetable)

  if (timetable.routeGTFSID === '2-SPT') {
    timetable = await addStonyPointData(db, timetable, tripStartTime)
  }

  if (mode === 'metro train') {
    timetable = extendMetroEstimation(timetable)
  }

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
