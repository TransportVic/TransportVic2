const async = require('async')
const moment = require('moment')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const nameModifier = require('../../additional-data/bus-stop-name-modifier')
const cityLoopRoute = require('./city-loop.json')

const fixTripDestination = require('../metro-trains/fix-trip-destinations')

let modes = {
  'metro train': 0,
  'regional train': 3,
  'regional coach': 3,
  'bus': 2,
  'nbus': 4,
  'tram': 1
}

module.exports = async function (db, ptvRunID, mode, time, stopID, referenceTrip) {
  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')
  let routesCollection = db.getCollection('routes')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/${modes[mode]}?expand=stop&expand=run&expand=route&expand=direction`
  if (time)
    url += `&date_utc=${time}`
  if (stopID)
    url += `&stop_id=${stopID}`

  let {departures, stops, runs, routes, directions} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  let ptvDirection = Object.values(directions)[0]
  let routeData = Object.values(routes)[0]

  if (mode === 'nbus') mode = 'bus'

  departures = departures.map(departure => {
    departure.actualDepartureTime = moment.tz(departure.estimated_departure_utc || departure.scheduled_departure_utc, 'Australia/Melbourne')
    departure.scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    departure.estimatedDepartureTime = moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne')
    return departure
  })

  let dbStops = {}
  let checkModes = [mode]
  if (mode === 'regional coach') checkModes.push('regional train')

  let routeGTFSID = routeData.route_gtfs_id
  if (mode === 'tram') routeGTFSID = `3-${parseInt(routeGTFSID.slice(2))}`
  let route = await routesCollection.findDocument({ routeGTFSID })

  if (routeData.route_id === 99) {
    route = cityLoopRoute
    routeGTFSID = '2-CCL'
  }

  let gtfsDirection = route.ptvDirections[ptvDirection.direction_name]

  await async.forEach(Object.values(stops), async stop => {
    let stopName = stop.stop_name.trim()
    if (mode === 'metro train') {
      if (stopName === 'Jolimont-MCG')
        stopName = 'Jolimont'

      stopName += ' Railway Station'
    }
    stopName = utils.adjustRawStopName(nameModifier(utils.adjustStopname(stopName)))
      .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')

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
        let stopName = utils.adjustRawStopName(nameModifier(utils.adjustStopname(ptvStop.stop_name.trim())))
          .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')

        let matchingService = bay.services.find(s => s.routeGTFSID === routeGTFSID && s.gtfsDirection === gtfsDirection)

        return checkModes.includes(bay.mode) && bay.fullStopName === stopName && matchingService
      })[0]
    if (!stopBay) {
      stopBay = dbStops[stop_id].bays
        .filter(bay => checkModes.includes(bay.mode))[0]
    }

    let departureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    let stopTiming = {
      stopName: stopBay.fullStopName,
      stopNumber: stopBay.stopNumber,
      suburb: stopBay.suburb,
      stopGTFSID: stopBay.stopGTFSID,
      arrivalTime: scheduledDepartureTime.format("HH:mm"),
      arrivalTimeMinutes: departureTimeMinutes,
      departureTime: scheduledDepartureTime.format("HH:mm"),
      departureTimeMinutes: departureTimeMinutes,
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

  let routeName = routeData.route_name.trim()
  if (routeGTFSID === '2-ain') routeName = 'Showgrounds/Flemington'

  let cancelled
  if (mode === 'metro train') {
    cancelled = run.status === 'cancelled'
  }

  let timetable = {
    mode, routeName,
    routeGTFSID,
    routeNumber: referenceTrip ? referenceTrip.routeNumber : routeData.route_number,
    routeDetails: referenceTrip ? referenceTrip.routeDetails : null,
    runID: vehicleDescriptor.id,
    operationDays: [tripOperationDay],
    vehicle: vehicleDescriptor.description || vehicleDescriptor.id,
    stopTimings: stopTimings,
    destination: stopTimings[stopTimings.length - 1].stopName,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].arrivalTime,
    departureTime: stopTimings[0].departureTime,
    origin: stopTimings[0].stopName,
    type: "timings",
    updateTime: new Date(),
    gtfsDirection,
    direction,
    cancelled
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
