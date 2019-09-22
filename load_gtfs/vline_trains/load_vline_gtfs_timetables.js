const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const fs = require('fs')
const async = require('async')
const EventEmitter = require('events');

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/1/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/1/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/1/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/1/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null
let routes = null
let gtfsTimetables = null

let calendarDatesCache = {}

let allTrips = {}

let stationLoaders = {}
let stationCache = {}
let routeLoaders = {}
let routeCache = {}

async function getStation(stopGTFSID) {
  if (stationLoaders[stopGTFSID]) {
    return await new Promise(resolve => stationLoaders[stopGTFSID].on('loaded', resolve))
  } else if (!stationCache[stopGTFSID]) {
    stationLoaders[stopGTFSID] = new EventEmitter()
    stationLoaders[stopGTFSID].setMaxListeners(20000)

    let station = await stops.findDocument({
      'bays.stopGTFSID': stopGTFSID
    })

    let metroStation = station.bays.filter(bay => bay.mode === 'regional train')[0]

    stationCache[stopGTFSID] = metroStation
    stationLoaders[stopGTFSID].emit('loaded', metroStation)
    delete stationLoaders[stopGTFSID]

    return metroStation
  } else return stationCache[stopGTFSID]
}

async function getRoute(routeGTFSID) {
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

database.connect({
  poolSize: 500
}, async err => {
  stops = database.getCollection('stops')
  routes = database.getCollection('routes')
  gtfsTimetables = database.getCollection('gtfs timetables')

  gtfsTimetables.createIndex({
    mode: 1,
    operator: 1,
    tripID: 1,
    routeName: 1,
    operationDays: 1,
    origin: 1,
    destination: 1
  }, {unique: true})

  await async.forEach(trips, async trip => {
    let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(trip[0]),
        serviceID = trip[1],
        tripID = gtfsUtils.simplifyRouteGTFSID(trip[2]),
        shapeID = gtfsUtils.simplifyRouteGTFSID(trip[3]),
        direction = ['city', 'melbourne'].includes(trip[4].toLowerCase())
    direction = direction ? 'Up' : 'Down'

    if (routeGTFSID === '1-vPK') return

    let route = await getRoute(routeGTFSID)
    if (!calendarDatesCache[serviceID])
      calendarDatesCache[serviceID] = gtfsUtils.calendarToDates(calendar, calendarDates, serviceID)

    allTrips[tripID] = {
      mode: "regional train",
      operator: "V/Line",
      routeName: route.routeName,
      shortRouteName: route.shortRouteName,
      tripID,
      operationDays: calendarDatesCache[serviceID].map(date => date.format('YYYYMMDD')),
      stopTimings: [],
      destination: null,
      departureTime: null,
      origin: null,
      direction
    }
  })

  await async.forEach(tripTimesData, async stopTiming => {
    let tripID = gtfsUtils.simplifyRouteGTFSID(stopTiming[0]),
        arrivalTime = stopTiming[1].slice(0, 5),
        departureTime = stopTiming[2].slice(0, 5),
        stopGTFSID = parseInt(stopTiming[3]),
        stopSequence = parseInt(stopTiming[4]),
        pickupFlags = stopTiming[6],
        dropoffFlags = stopTiming[7],
        stopDistance = parseInt(stopTiming[8])

    if (!allTrips[tripID]) return // filtered off unless gtfs data is whack

    let station = await getStation(stopGTFSID)

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

    const key = {
      mode: 'regional train',
      tripID: tripID
    }

    bulkOperations.push({
      replaceOne: {
        filter: key,
        replacement: allTrips[tripID],
        upsert: true
      }
    })
  })

  await gtfsTimetables.bulkWrite(bulkOperations)

  console.log('Completed loading in ' + Object.keys(allTrips).length + ' V/Line trips')
  process.exit()
})
