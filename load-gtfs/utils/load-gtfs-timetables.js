const async = require('async')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const EventEmitter = require('events')
const crypto = require('crypto')

let calendarDatesCache = {}

let stopLoaders = {}
let stopCache = {}
let routeLoaders = {}
let routeCache = {}

async function getStop(stopGTFSID, stops, mode) {
  if (stopLoaders[stopGTFSID]) {
    return await new Promise(resolve => stopLoaders[stopGTFSID].on('loaded', resolve))
  } else if (!stopCache[stopGTFSID]) {
    stopLoaders[stopGTFSID] = new EventEmitter()
    stopLoaders[stopGTFSID].setMaxListeners(Infinity)

    let stop = await stops.findDocument({
      bays: {
        $elemMatch: {
          stopGTFSID, mode
        }
      }
    })

    let bay = stop.bays.filter(bay => bay.stopGTFSID === stopGTFSID && bay.mode === mode)[0]

    stopCache[stopGTFSID] = bay

    let data = {stop: bay, id: stop._id}
    stopLoaders[stopGTFSID].emit('loaded', data)
    delete stopLoaders[stopGTFSID]

    return data
  } else return stopCache[stopGTFSID]
}

async function getRoute(routeGTFSID, routes) {
  if (routeLoaders[routeGTFSID]) {
    return await new Promise(resolve => routeLoaders[routeGTFSID].on('loaded', resolve))
  } else if (!routeCache[routeGTFSID]) {
    routeLoaders[routeGTFSID] = new EventEmitter()
    routeLoaders[routeGTFSID].setMaxListeners(Infinity)

    let route = await routes.findDocument({ routeGTFSID })

    routeCache[routeGTFSID] = route
    routeLoaders[routeGTFSID].emit('loaded', route)
    delete routeLoaders[routeGTFSID]

    return route
  } else return routeCache[routeGTFSID]
}

function hashTrip(trip) {
  let hash = crypto.createHash('sha1')
  hash.update(trip.origin)
  hash.update(trip.departureTime)
  hash.update(trip.destination)
  hash.update(trip.stopTimings.slice(-1)[0].arrivalTime)
  return parseInt(hash.digest('hex'), 16)
}

async function loadBatchIntoDB(db, calendar, calendarDates, tripTimesData, mode, determineDirection, routeFilter, trips) {
  let stops = db.getCollection('stops')
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let allTrips = {}

  await async.forEach(trips, async trip => {
    let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(trip[0]),
        serviceID = trip[1],
        tripID = trip[2],
        shapeID = trip[3],
        direction = determineDirection(trip[4].toLowerCase(), routeGTFSID),
        gtfsDirection = trip[5]

    if (!routeFilter(routeGTFSID)) return

    let route = await getRoute(routeGTFSID, routes)
    if (!calendarDatesCache[serviceID])
      calendarDatesCache[serviceID] = gtfsUtils.calendarToDates(calendar, calendarDates, serviceID)

    allTrips[tripID] = {
      mode: mode,
      routeName: route.routeName,
      shortRouteName: route.shortRouteName,
      tripID,
      routeGTFSID,
      operationDays: calendarDatesCache[serviceID].map(date => date.format('YYYYMMDD')),
      stopTimings: [],
      destination: null,
      departureTime: null,
      destinationArrivalTime: null,
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

    let {stop, id} = await getStop(stopGTFSID, stops, mode)

    allTrips[tripID].stopTimings[stopSequence - 1] = {
      stopName: stop.fullStopName,
      stopNumber: stop.stopNumber,
      stopID: id,
      stopGTFSID,
      arrivalTime,
      arrivalTimeMinutes: utils.time24ToMinAftMidnight(arrivalTime) % 1440,
      departureTime,
      departureTimeMinutes: utils.time24ToMinAftMidnight(departureTime) % 1440,
      stopConditions: {
        pickup: pickupFlags,
        dropoff: dropoffFlags
      },
      stopDistance: stopDistance,
      stopSequence
    }
  })

  let bulkOperations = []

  await async.forEach(Object.keys(allTrips), async tripID => {
    allTrips[tripID].stopTimings = allTrips[tripID].stopTimings.filter(Boolean)
    let stopTimings = allTrips[tripID].stopTimings
    stopTimings = stopTimings.filter(Boolean)

    stopTimings = stopTimings.map((e, i, a) => {
      if (i === 0) return e
      if (e.arrivalTimeMinutes < a[i - 1].departureTimeMinutes) {
        e.arrivalTimeMinutes += 1440
        e.departureTimeMinutes += 1440
      }
      if (e.departureTimeMinutes < a[i - 1].departureTimeMinutes) {
        e.departureTimeMinutes += 1440
      }
      return e
    })
    let stopCount = stopTimings.length

    allTrips[tripID].destination = stopTimings[stopCount - 1].stopName
    allTrips[tripID].destinationArrivalTime = stopTimings[stopCount - 1].arrivalTime
    allTrips[tripID].departureTime = stopTimings[0].departureTime
    allTrips[tripID].origin = stopTimings[0].stopName

    stopTimings[0].arrivalTime = null
    stopTimings[0].arrivalTimeMinutes = null

    stopTimings[stopCount - 1].departureTime = null
    stopTimings[stopCount - 1].departureTimeMinutes = null

    allTrips[tripID].tripStartMinute = stopTimings[0].departureTimeMinutes
    allTrips[tripID].tripEndMinute = stopTimings[stopCount - 1].arrivalTimeMinutes
    if (allTrips[tripID].tripEndMinute < allTrips[tripID].tripStartMinute) {
      allTrips[tripID].tripEndMinute += 1440
    }

    bulkOperations.push({
      insertOne: {
        document: allTrips[tripID]
      }
    })
  })

  await gtfsTimetables.bulkWrite(bulkOperations, {
    ordered: false
  })

  let length = Object.keys(allTrips).length

  bulkOperations = null
  allTrips = null
  return length
}

module.exports = async function(db, calendar, calendarDates, trips, tripTimesData, mode, determineDirection=()=>null, routeFilter=()=>true, deleteAll=true) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  await gtfsTimetables.createIndex({
    mode: 1,
    routeName: 1,
    routeGTFSID: 1,
    operationDays: 1,
    destination: 1,
    tripStartMinute: 1,
    tripEndMinute: 1,
    tripID: 1,
    shapeID: 1
  }, {unique: true, name: 'gtfs timetable index'})

  await gtfsTimetables.createIndex({
    shapeID: 1
  }, {name: 'shapeID index'})
  await gtfsTimetables.createIndex({
    operationDays: 1
  }, {name: 'operationDays index'})

  await gtfsTimetables.createIndex({
    operationDays: 1,
    routeGTFSID: 1,
    tripStartMinute: 1,
    tripEndMinute: 1
  }, {name: 'operationDays + routeGTFSID + start stop times index'})

  await gtfsTimetables.createIndex({
    destination: 1
  }, {name: 'destination index'})
  await gtfsTimetables.createIndex({
    mode: 1,
    routeGTFSID: 1
  }, {name: 'mode/routeGTFSID index'})
  await gtfsTimetables.createIndex({
    'stopTimings.stopID': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'stop timings index'})
  await gtfsTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'stop timings gtfs index'})
  await gtfsTimetables.createIndex({
    routeGTFSID: 1,
    gtfsDirection: 1,
    'stopTimings.stopID': 1,
    'stopTimings.departureTimeMinutes': 1,
  }, {name: 'route gtfs id+stop timings index'})

  let services = {}
  trips.forEach(trip => {
    let tripGTIFSID = gtfsUtils.simplifyRouteGTFSID(trip[0])
    if (!services[tripGTIFSID]) services[tripGTIFSID] = []
    services[tripGTIFSID].push(trip)
  })
  services = Object.values(services)
  trips = null

  if (deleteAll)
    await gtfsTimetables.deleteDocuments({mode})
  let boundLoadBatch = loadBatchIntoDB.bind(null, db, calendar, calendarDates, tripTimesData, mode, determineDirection, routeFilter)

  let loaded = 0
  let start = 0

  async function loadBatch() {
    let tripsToLoad = services.slice(start, start += 5)
    let serviceCount = tripsToLoad.length

    tripsToLoad = tripsToLoad.reduce((acc, e) => acc.concat(e), [])

    if (!serviceCount) return
    loaded += await boundLoadBatch(tripsToLoad)

    console.log('completed ' + start + ' of ' + services.length + ' services')

    stopsCache = null
    routeCache = null

    stopCache = {} // help clear memory at the expense of speed
    routeCache = {}

    if (global.gc)
      global.gc()

    await loadBatch()
  }

  await loadBatch()

  return loaded
}
