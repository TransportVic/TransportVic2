const async = require('async')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const EventEmitter = require('events')

let calendarDatesCache = {}

let stationLoaders = {}
let stationCache = {}
let routeLoaders = {}
let routeCache = {}

async function getStation(stopGTFSID, stops, mode) {
  if (stationLoaders[stopGTFSID]) {
    return await new Promise(resolve => stationLoaders[stopGTFSID].on('loaded', resolve))
  } else if (!stationCache[stopGTFSID]) {
    stationLoaders[stopGTFSID] = new EventEmitter()
    stationLoaders[stopGTFSID].setMaxListeners(5000)

    let station = await stops.findDocument({
      'bays.stopGTFSID': stopGTFSID
    })

    let metroStation = station.bays.filter(bay => bay.mode === mode)[0]

    stationCache[stopGTFSID] = metroStation
    stationLoaders[stopGTFSID].emit('loaded', metroStation)
    delete stationLoaders[stopGTFSID]

    return metroStation
  } else return stationCache[stopGTFSID]
}

async function getRoute(routeGTFSID, routes) {
  if (routeLoaders[routeGTFSID]) {
    return await new Promise(resolve => routeLoaders[routeGTFSID].on('loaded', resolve))
  } else if (!routeCache[routeGTFSID]) {
    routeLoaders[routeGTFSID] = new EventEmitter()
    routeLoaders[routeGTFSID].setMaxListeners(5000)

    let route = await routes.findDocument({ routeGTFSID })

    routeCache[routeGTFSID] = route
    routeLoaders[routeGTFSID].emit('loaded', route)
    delete routeLoaders[routeGTFSID]

    return route
  } else return routeCache[routeGTFSID]
}

module.exports = async function(db, calendar, calendarDates, trips, tripTimesData, mode, determineDirection=()=>null, routeFilter=()=>true, operator=()=>null) {
  let stops = db.getCollection('stops')
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  await gtfsTimetables.deleteDocuments({mode})

  let allTrips = {}

  await async.forEach(trips, async trip => {
    let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(trip[0]),
        serviceID = trip[1],
        tripID = trip[2],
        shapeID = trip[3],
        direction = determineDirection(trip[4].toLowerCase())
        gtfsDirection = trip[5]

    if (!routeFilter(routeGTFSID)) return

    let route = await getRoute(routeGTFSID, routes)
    if (!calendarDatesCache[serviceID])
      calendarDatesCache[serviceID] = gtfsUtils.calendarToDates(calendar, calendarDates, serviceID)

    allTrips[tripID] = {
      mode: mode,
      operator: operator(routeGTFSID),
      routeName: route.routeName,
      shortRouteName: route.shortRouteName,
      tripID,
      routeGTFSID,
      operationDays: calendarDatesCache[serviceID].map(date => date.format('YYYYMMDD')),
      stopTimings: [],
      destination: null,
      departureTime: null,
      origin: null,
      direction,
      gtfsDirection,
      shapeID
    }
  })

  await async.forEach(tripTimesData, async stopTiming => {
    let tripID = stopTiming[0],
        arrivalTime = stopTiming[1].slice(0, 5),
        departureTime = stopTiming[2].slice(0, 5),
        stopGTFSID = parseInt(stopTiming[3]),
        stopSequence = parseInt(stopTiming[4]),
        pickupFlags = stopTiming[6],
        dropoffFlags = stopTiming[7],
        stopDistance = parseInt(stopTiming[8])

    if (!allTrips[tripID]) return // filtered off unless gtfs data is whack

    let station = await getStation(stopGTFSID, stops, mode)

    allTrips[tripID].stopTimings[stopSequence - 1] = {
      stopName: station.fullStopName,
      stopGTFSID,
      arrivalTime,
      arrivalTimeMinutes: utils.time24ToMinAftMidnight(arrivalTime),
      departureTime,
      departureTimeMinutes: utils.time24ToMinAftMidnight(departureTime),
      stopConditions: "",
      stopDistance: stopDistance,
      stopSequence
    }
  })

  let bulkOperations = []

  await async.forEach(Object.keys(allTrips), async tripID => {
    allTrips[tripID].stopTimings = allTrips[tripID].stopTimings.filter(Boolean)
    let stopTimings = allTrips[tripID].stopTimings

    stopTimings = stopTimings.filter(Boolean)
    let stopCount = stopTimings.length

    allTrips[tripID].destination = stopTimings[stopCount - 1].stopName
    allTrips[tripID].departureTime = stopTimings[0].departureTime
    allTrips[tripID].origin = stopTimings[0].stopName

    stopTimings[0].arrivalTime = null
    stopTimings[0].arrivalTimeMinutes = null

    stopTimings[stopCount - 1].departureTime = null
    stopTimings[stopCount - 1].departureTimeMinutes = null

    allTrips[tripID].tripStartHour = Math.floor(stopTimings[0].departureTimeMinutes / 60)
    allTrips[tripID].tripEndHour = Math.floor(stopTimings[stopCount - 1].arrivalTimeMinutes / 60)

    bulkOperations.push({
      insertOne: {
        document: allTrips[tripID]
      }
    })
  })

  await gtfsTimetables.bulkWrite(bulkOperations)

  return Object.keys(allTrips).length
}
