const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const nameModifier = require('../../additional-data/stop-name-modifier')
const determineBusRouteNumber = require('../../additional-data/determine-bus-route-number')
const regionalRouteNumbers = require('../../additional-data/bus-data/regional-with-track')
const { getStop } = require('../utils/get-bus-timetables')

let regionalGTFSIDs = Object.keys(regionalRouteNumbers).reduce((acc, region) => {
  let regionRoutes = regionalRouteNumbers[region]

  regionRoutes.forEach(route => {
    acc[route.routeGTFSID] = { region, routeNumber: route.routeNumber }
  })

  return acc
}, {})

function determineStopType(stop) {
  let busBays = stop.bays.filter(bay => bay.mode === 'bus')
  let screenServices = busBays.map(bay => bay.screenServices).reduce((a, e) => a.concat(e), [])
  let stopType = ''

  if (screenServices.some(svc => svc.routeGTFSID.startsWith('4-'))) {
    stopType = 'metro'
  } else { // Regional/Skybus
    if (screenServices.some(svc => regionalGTFSIDs[svc.routeGTFSID])) {
      stopType = 'regional-live'
    } else {
      stopType = 'regional'
    }
  }

  return { stopType, screenServices }
}

async function getRoutes(db, cacheKey, query) {
  return await utils.getData('bus-routes', cacheKey, async () => {
    return await db.getCollection('routes').findDocuments(query, { routePath: 0 }).toArray()
  })
}

module.exports = async function (data, db) {
  let { ptvRunID, time, referenceTrip } = data

  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let routesCollection = db.getCollection('routes')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/2?expand=stop&expand=run&expand=route&expand=direction&expand=VehicleDescriptor`

  if (time) url += `&date_utc=${time}`

  let {departures, stops, runs, routes, directions} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  let ptvDirection = Object.values(directions)[0]
  let routeData = Object.values(routes)[0]

  if (departures.length === 0) return referenceTrip

  let dbStops = {}

  let firstStopData = await getStop(stops[departures[0].stop_id], stopsCollection)
  let { stopType, screenServices } = determineStopType(firstStopData)

  if (stopType === 'regional') return referenceTrip

  let routeGTFSIDQuery
  let ptvRouteNumber = routeData.route_number
  // PTV BUG: bus route incorrectly returned
  // Eg. Geelong 25 "Geelong Station - Bell Post Hill  (Route 25)" route number is "Geelong Station"
  if (!ptvRouteNumber.match(/\d/)) ptvRouteNumber = routeData.route_name.match(/Route (\d+)/)[1]
  let busRoute

  if (!ptvRouteNumber) return

  if (stopType === 'metro') {
    let potentialBusRoutes = await getRoutes(db, `M-${ptvRouteNumber}`, {
      routeNumber: ptvRouteNumber,
      routeGTFSID: /^4-/
    })

    routeGTFSIDQuery = {
      $in: potentialBusRoutes.map(route => route.routeGTFSID)
    }
  } else if (stopType === 'regional-live') {
    let liveRoute = screenServices.find(svc => regionalGTFSIDs[svc.routeGTFSID])
    let regionRoute = regionalGTFSIDs[liveRoute.routeGTFSID]

    routeGTFSIDQuery = {
      $in: regionalRouteNumbers[regionRoute.region].filter(route => route.routeNumber === ptvRouteNumber).map(route => route.routeGTFSID)
    }
  }

  let possibleRoutes = await routesCollection.findDocuments({ routeGTFSID: routeGTFSIDQuery }).toArray()
  let originDepartureTime = utils.parseTime(departures[0].scheduled_departure_utc)
  let departureTimeMinutes = utils.getMinutesPastMidnight(originDepartureTime)
  if (departureTimeMinutes < 180) originDepartureTime.add(-4, 'hours') // if first stop is 12-3am push it to previous day

  let departureDay = utils.getYYYYMMDD(originDepartureTime)

  let route = await async.find(possibleRoutes, async routeData => {
    let scheduledTrip = await gtfsTimetables.findDocument({
      operationDays: departureDay,
      routeGTFSID: routeData.routeGTFSID
    })

    return !!scheduledTrip
  }) || possibleRoutes[0]

  let routeGTFSID = route.routeGTFSID

  let directionName = ptvDirection.direction_name
  let gtfsDirection = route.ptvDirections[directionName]

  await async.forEach(Object.values(stops), async stop => {
    let dbStop = await getStop(stop, stopsCollection)

    if (!dbStop) global.loggers.general.err('Failed to match stop', stop)
    dbStops[stop.stop_id] = dbStop
  })

  let previousDepartureTime = -1

  let stopTimings = departures.map((departure, i) => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null
    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

    let ptvStop = stops[departure.stop_id]
    if (!ptvStop) return null // Stop likely deactivated or does not exist but returned by operational timetable - skip it

    let stopName = utils.getProperStopName(ptvStop.stop_name)

    let stopBay = dbStops[departure.stop_id].bays.find(bay => {
      let matchingService = bay.services.some(s => s.routeGTFSID === routeGTFSID && s.gtfsDirection === gtfsDirection)

      return bay.mode === 'bus' && bay.fullStopName === stopName && matchingService
    }) || dbStops[departure.stop_id].bays.find(bay => bay.mode === 'bus')

    let departureTimeMinutes = utils.getMinutesPastMidnight(scheduledDepartureTime)

    if (departureTimeMinutes < previousDepartureTime) departureTimeMinutes += 1440
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
      platform: null,
      stopConditions: {
        pickup: departure.flags.includes('DOO') ? 1 : 0, // if dropoff only then pickup is unavailable
        dropoff: departure.flags.includes('PUO') ? 1 : 0
      }
    }

    return stopTiming
  }).filter(Boolean)

  let vehicleDescriptor = run.vehicle_descriptor

  let firstStop = stopTimings[0]
  let lastStop = stopTimings[stopTimings.length - 1]

  firstStop.arrivalTime = null
  firstStop.arrivalTimeMinutes = null
  lastStop.departureTime = null
  lastStop.departureTimeMinutes = null

  let timetable = {
    mode: 'bus',
    routeName: route.routeName,
    routeGTFSID,
    routeNumber: referenceTrip ? referenceTrip.routeNumber : route.routeNumber,
    routeDetails: referenceTrip ? referenceTrip.routeDetails : null,
    runID: null,
    operationDays: departureDay,
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
    runID: ptvRunID.includes('-') ? ptvRunID : null
  }

  timetable.routeNumber = determineBusRouteNumber(timetable)

  // if first stop is 12-3am push it to previous day
  if (stopTimings[0].departureTimeMinutes < 180) {
    timetable.stopTimings.forEach(stop => {
      if (stop.arrivalTimeMinutes !== null) stop.arrivalTimeMinutes += 1440
      if (stop.departureTimeMinutes !== null) stop.departureTimeMinutes += 1440
    })
  }

  let key = {
    mode: 'bus',
    routeGTFSID,
    operationDays: timetable.operationDays,
    departureTime: timetable.departureTime,
    destinationArrivalTime: timetable.destinationArrivalTime
  }

  await liveTimetables.replaceDocument(key, timetable, {
    upsert: true
  })

  return timetable
}
