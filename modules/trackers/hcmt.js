const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const ptvAPI = require('../../ptv-api')
const { getDayOfWeek } = require('../../public-holidays')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let liveTimetables

let weekend = ['Sat', 'Sun']
let times = {
  "RMD-FSS": {
    "Weekday": 4,
    "Weekend": 3,
  },
  "SSS-FSS": {
    "Weekday": 4,
    "Weekend": 4
  },
  "CDA-PKM": {
    "Weekday": 6,
    "Weekend": 6
  }
}

async function requestMetroData() {
  let data = JSON.parse(await utils.request(urls.hcmt))
  return data.entries
}

function appendLastStop(trip) {
  let type = weekend.includes(trip.dayOfWeek) ? 'Weekend' : 'Weekday'

  let prevStop, minutesDiff, stopName, platform

  if (trip.direction === 'Down') { // Last stop given CDA
    prevStop = trip.stopsAvailable.find(stop => stop.stopName === 'Cardinia Road Railway Station')
    if (prevStop) {
      minutesDiff = times['CDA-PKM'][type]
      stopName = 'Pakenham Railway Station'
      platform = '1'
    }
  } else { // Last stop given either SSS (VL) or RMD (Direct)
    prevStop = trip.stopsAvailable[trip.stopsAvailable.length - 1]
    if (prevStop.stopName === 'Richmond Railway Station') {
      minutesDiff = times['RMD-FSS'][type]
    } else if (prevStop.stopName === 'Southern Cross Railway Station') {
      minutesDiff = times['SSS-FSS'][type]
    }

    if (minutesDiff) {
      stopName = 'Flinders Street Railway Station'
      platform = '7'
    }
  }

  if (minutesDiff) {
    trip.stopsAvailable.push({
      stopName,
      scheduledDepartureTime: prevStop.scheduledDepartureTime.clone().add(minutesDiff, 'minutes'),
      estimatedDepartureTime: prevStop.estimatedDepartureTime.clone().add(minutesDiff, 'minutes'),
      scheduledDepartureMinutes: prevStop.scheduledDepartureMinutes + minutesDiff,
      platform
    })
  }
}

async function appendNewData(existingTrip, newData) {
  existingTrip.stopTimings.forEach(stop => {
    let updatedData = newData.stopsAvailable.find(newStop => newStop.stopName === stop.stopName)

    if (updatedData) {
      stop.estimatedDepartureTime = updatedData.estimatedDepartureTime.toISOString()
      stop.platform = updatedData.platform
    }
  })

  await liveTimetables.updateDocument({
    _id: existingTrip._id
  }, {
    $set: {
      stopTimings: existingTrip.stopTimings
    }
  })
}

async function createTrip(trip) {
  let stopTimings = await async.map(trip.stopsAvailable, async stop => {
    let stopData = await dbStops.findDocument({ stopName: stop.stopName })
    let metroBay = stopData.bays.find(bay => bay.mode === 'metro train')

    let scheduledTime = utils.formatHHMM(stop.scheduledDepartureTime)

    return {
      stopName: stop.stopName,
      stopNumber: null,
      suburb: metroBay.suburb,
      stopGTFSID: metroBay.stopGTFSID,
      arrivalTime: scheduledTime,
      arrivalTimeMinutes: stop.scheduledDepartureMinutes,
      departureTime: scheduledTime,
      departureTimeMinutes: stop.scheduledDepartureMinutes,
      estimatedDepartureTime: stop.estimatedDepartureTime.toISOString(),
      scheduledDepartureTime: stop.scheduledDepartureTime.toISOString(),
      platform: stop.platform,
      stopConditions: { pickup: "0", dropoff: "0" }
    }
  })

  let firstStop = stopTimings[0]
  let lastStop = stopTimings[trip.stopsAvailable.length - 1]

  let timetable = {
    mode: 'metro train',
    routeName: 'Pakenham',
    routeGTFSID: '2-PKM',
    runID: trip.runID,
    operationDays: trip.operationDays,
    vehicle: '7x HCMT',
    stopTimings,
    trueDestination: lastStop.stopName,
    destination: lastStop.stopName,
    trueDestinationArrivalTime: lastStop.arrivalTime,
    destinationArrivalTime: lastStop.arrivalTime,
    departureTime: firstStop.departureTime,
    trueDepartureTime: firstStop.departureTime,
    origin: firstStop.stopName,
    trueOrigin: firstStop.stopName,
    gtfsDirection: trip.direction === 'Down' ? '0' : '1',
    direction: trip.direction,
    shapeID: '',
    gtfsMode: 2,
    h: true
  }

  await liveTimetables.createDocument(timetable)
}

async function getDepartures(stop) {
  let stopDepartures = await requestMetroData()
  let extraTrips = stopDepartures.filter(trip => trip.trip_id[0] === '7')

  // Tracker only runs at reasonable times, no 3am to worry about
  let startOfDay = utils.now().startOf('day')
  let day = utils.getYYYYMMDD(startOfDay)
  let dayOfWeek = await getDayOfWeek(startOfDay)

  let allTrips = Object.values(extraTrips.reduce((trips, stop) => {
    let runID = stop.trip_id
    if (!trips[runID]) trips[runID] = {
      runID: runID,
      stopsAvailable: [],
      direction: runID[3] % 2 === 0 ? 'Up' : 'Down',
      operationDays: day,
      dayOfWeek
    }

    let scheduledDepartureTime = startOfDay.clone().add(stop.time_seconds, 'seconds')
    let estimatedDepartureTime = startOfDay.clone().add(stop.estimated_departure_time_seconds, 'seconds')

    trips[runID].stopsAvailable.push({
      stopName: stop.station + ' Railway Station',
      scheduledDepartureTime,
      estimatedDepartureTime,
      scheduledDepartureMinutes: Math.round(parseInt(stop.time_seconds) / 60),
      platform: stop.estimated_platform
    })

    return trips
  }, {}))

  await async.forEach(allTrips, async trip => {
    appendLastStop(trip)

    let existingTrip = await liveTimetables.findDocument({
      operationDays: day,
      runID: trip.runID
    })

    if (existingTrip) {
      if (existingTrip.h) {
        await appendNewData(existingTrip, trip)
      }
    } else {
      let ptvRunID = 948000 + parseInt(trip.runID)
      let resp = await ptvAPI(`/v3/pattern/run/${ptvRunID}/route_type/0`)
      if (resp.departures.length === 0) { // PTV Doesnt have it, likely to be HCMT
        global.loggers.metro.log('[HCMT]: Identified HCMT Trip #' + trip.runID)
        await createTrip(trip)
      } else {
        await getStoppingPattern(database, ptvRunID, 'metro train')
      }
    }
  })
}

async function requestTimings() {
  global.loggers.trackers.metro.info('Looking for hcmt trips')

  try {
    let departures = await getDepartures()
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to find HCMT trips, skipping', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  liveTimetables = database.getCollection('live timetables')

  schedule([
    [360, 1199, 4],
    [1200, 1380, 5]
  ], requestTimings, 'hcmt tracker', global.loggers.trackers.metro)
})
