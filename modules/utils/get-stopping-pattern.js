const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const nameModifier = require('../../additional-data/stop-name-modifier')
const gtfsGroups = require('../gtfs-id-groups')
const determineBusRouteNumber = require('../../additional-data/determine-bus-route-number')

let modes = {
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

  if (time) url += `&date_utc=${time}`
  if (stopID) url += `&stop_id=${stopID}`

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

  let routeGTFSIDQuery = routeGTFSID, matchingGroup
  if (matchingGroup = gtfsGroups.find(g => g.includes(routeGTFSID))) {
    routeGTFSIDQuery = { $in: matchingGroup }
  }

  let route = await routesCollection.findDocument({ routeGTFSID: routeGTFSIDQuery })

  let directionName = ptvDirection.direction_name
  let gtfsDirection = route.ptvDirections[directionName]

  if (mode === 'tram') {
    let keys = Object.keys(route.ptvDirections)
    let bestKey = keys.find(k => k.replace(/[\w ]+ to/).includes(directionName))
    if (bestKey) gtfsDirection = route.ptvDirections[bestKey]
  }

  let previousDepartureTime = -1

  await async.forEach(Object.values(stops), async stop => {
    let stopName = utils.getProperStopName(stop.stop_name.trim())

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
      arrivalTime: utils.formatHHMM(scheduledDepartureTime),
      arrivalTimeMinutes: departureTimeMinutes,
      departureTime: utils.formatHHMM(scheduledDepartureTime),
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

  stopTimings[0].arrivalTime = null
  stopTimings[0].arrivalTimeMinutes = null
  stopTimings.slice(-1)[0].departureTime = null
  stopTimings.slice(-1)[0].departureTimeMinutes = null

  let timetable = {
    mode, routeName: route.routeName,
    routeGTFSID,
    routeNumber: referenceTrip ? referenceTrip.routeNumber : route.routeNumber,
    routeDetails: referenceTrip ? referenceTrip.routeDetails : null,
    runID: null,
    operationDays: tripOperationDay,
    vehicle: null,
    stopTimings: stopTimings,
    destination: stopTimings[stopTimings.length - 1].stopName,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].arrivalTime,
    departureTime: stopTimings[0].departureTime,
    origin: stopTimings[0].stopName,
    type: 'timings',
    updateTime: new Date(),
    gtfsDirection,
    direction: null,
    cancelled: null,
    suspensions: null,
    ...extraTripData
  }

  if (mode === 'bus') timetable.routeNumber = determineBusRouteNumber(timetable)

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
