const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let liveTimetables

async function getTimetable() {
  return await utils.getData('metro-op-timetable', '92', async () => {
    return JSON.parse(await utils.request(urls.op))
  }, 1000 * 60 * 60)
}

async function requestMetroData() {
  let data = JSON.parse(await utils.request(urls.hcmt))
  return data.entries
}


async function appendLastStop(trip) {
  let prevStop, minutesDiff, stopName, platform

  if (trip.direction === 'Down') { // Last stop given CDA
    prevStop = trip.stopTimings.find(stop => stop.stopName === 'Cardinia Road Railway Station')
    if (prevStop) {
      minutesDiff = 6
      stopName = 'Pakenham Railway Station'
      platform = '1'
    }
  }

  if (minutesDiff) {
    let stopData = await dbStops.findDocument({ stopName })
    let metroBay = stopData.bays.find(bay => bay.mode === 'metro train')
    let prevScheduled = utils.parseTime(prevStop.scheduledDepartureTime)
    let prevEstimated = prevStop.estimatedDepartureTime ? utils.parseTime(prevStop.estimatedDepartureTime) : null

    let newScheduled = prevScheduled.clone().add(minutesDiff, 'minutes')
    let scheduledTime = utils.formatHHMM(newScheduled)
    let newEstimated = prevEstimated ? prevEstimated.clone().add(minutesDiff, 'minutes').toISOString() : null

    trip.stopTimings.push({
      stopName: stopName,
      stopNumber: null,
      suburb: metroBay.suburb,
      stopGTFSID: metroBay.stopGTFSID,
      arrivalTime: scheduledTime,
      arrivalTimeMinutes: prevStop.departureTimeMinutes + minutesDiff,
      departureTime: scheduledTime,
      departureTimeMinutes: prevStop.departureTimeMinutes + minutesDiff,
      estimatedDepartureTime: newEstimated,
      scheduledDepartureTime: newScheduled.toISOString(),
      platform,
      stopConditions: { pickup: "0", dropoff: "0" }
    })
  }
}

async function appendNewData(existingTrip, stopDescriptors, startOfDay) {
  existingTrip.stopTimings.forEach(stop => {
    let updatedData = stopDescriptors.find(newStop => stop.stopName.includes(newStop.station))

    if (updatedData) {
      stop.estimatedDepartureTime = startOfDay.clone().add(updatedData.estimated_departure_time_seconds, 'seconds').toISOString()
      stop.platform = updatedData.estimated_platform
    }
  })

  let existingLastStop = existingTrip.destination
  let index = stopDescriptors.findIndex(stop => existingLastStop.includes(stop.stopName))
  if (index !== -1) {
    let baseTrip = stopDescriptors.slice(index + 1).map(stop => parseRawData(stop, startOfDay))

    let newStops = await mapStops(baseTrip, stopDescriptors, startOfDay)
    existingTrip.stopTimings = existingTrip.stopTimings.concat(newStops)
  }

  await appendLastStop(existingTrip)

  let lastStop = existingTrip.stopTimings[existingTrip.stopTimings.length - 1]

  await liveTimetables.updateDocument({
    _id: existingTrip._id
  }, {
    $set: {
      stopTimings: existingTrip.stopTimings,
      trueDestination: lastStop.stopName,
      destination: lastStop.stopName,
      trueDestinationArrivalTime: lastStop.arrivalTime,
      destinationArrivalTime: lastStop.arrivalTime,
    }
  })
}

async function mapStops(stops, stopDescriptors, startOfDay) {
  return await async.map(stops, async stop => {
    let stopData = await dbStops.findDocument({ stopName: stop.stopName })
    let metroBay = stopData.bays.find(bay => bay.mode === 'metro train')

    let scheduledTime = utils.formatHHMM(stop.scheduledDepartureTime)
    let departureData = stopDescriptors.find(stopDescriptor => stop.stopName.startsWith(stopDescriptor.station))
    let estimatedDepartureTime, platform = stop.platform

    if (departureData) {
      estimatedDepartureTime = startOfDay.clone().add(departureData.estimated_departure_time_seconds, 'seconds').toISOString()
      platform = departureData.estimated_platform
    }

    return {
      stopName: stop.stopName,
      stopNumber: null,
      suburb: metroBay.suburb,
      stopGTFSID: metroBay.stopGTFSID,
      arrivalTime: scheduledTime,
      arrivalTimeMinutes: stop.scheduledDepartureMinutes,
      departureTime: scheduledTime,
      departureTimeMinutes: stop.scheduledDepartureMinutes,
      estimatedDepartureTime,
      scheduledDepartureTime: stop.scheduledDepartureTime.toISOString(),
      platform,
      stopConditions: { pickup: "0", dropoff: "0" }
    }
  })
}

async function createTrip(trip, stopDescriptors, startOfDay) {
  let stopTimings = await mapStops(trip.stopsAvailable, stopDescriptors, startOfDay)

  let firstStop = stopTimings[0]
  let lastStop = stopTimings[trip.stopsAvailable.length - 1]

  let timetable = {
    mode: 'metro train',
    routeName: 'Pakenham',
    routeGTFSID: '2-PKM',
    runID: trip.runID,
    operationDays: trip.operationDays,
    vehicle: '7 Car HCMT',
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

function parseRawData(stop, startOfDay) {
  let scheduledDepartureTime = startOfDay.clone().add(stop.time_seconds, 'seconds')

  return {
    stopName: stop.station + ' Railway Station',
    scheduledDepartureTime,
    scheduledDepartureMinutes: Math.round(parseInt(stop.time_seconds) / 60),
    platform: stop.platform
  }
}

async function getDepartures(stop) {
  let timetable = await getTimetable()
  let extraTrips = timetable.filter(trip => trip.trip_id[0] === '7')
  let stopDepartures = await requestMetroData()

  // Tracker only runs at reasonable times, no 3am to worry about
  let startOfDay = utils.now().startOf('day')
  let day = utils.getYYYYMMDD(startOfDay)
  let now = utils.now()

  let allTrips = Object.values(extraTrips.reduce((trips, stop) => {
    let runID = stop.trip_id
    if (!trips[runID]) trips[runID] = {
      runID: runID,
      stopsAvailable: [],
      direction: runID[3] % 2 === 0 ? 'Up' : 'Down',
      operationDays: day
    }

    trips[runID].stopsAvailable.push(parseRawData(stop, startOfDay))

    return trips
  }, {}))

  let runIDs = allTrips.map(trip => trip.runID)

  await async.forEach(allTrips, async trip => {
    let existingTrip = await liveTimetables.findDocument({
      operationDays: day,
      runID: trip.runID
    })

    let stopDescriptors = stopDepartures.filter(stop => stop.trip_id === trip.runID)

    if (existingTrip) {
      if (existingTrip.h) {
        await appendNewData(existingTrip, stopDescriptors, startOfDay)
      }
    } else {
      let ptvRunID = 948000 + parseInt(trip.runID)
      let resp = await ptvAPI(`/v3/pattern/run/${ptvRunID}/route_type/0?date_utc=${now.toISOString()}`)
      let firstDeparture = resp.departures[0]
      let firstDepartureDay = firstDeparture ? utils.getYYYYMMDD(utils.parseTime(firstDeparture.scheduled_departure_utc)) : null

      if (!firstDeparture || firstDepartureDay !== day) { // PTV Doesnt have it, likely to be HCMT
        global.loggers.trackers.metro.log('[HCMT]: Identified HCMT Trip #' + trip.runID)
        await createTrip(trip, stopDescriptors, startOfDay)
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
    [360, 1199, 3],
    [1200, 1380, 4]
  ], requestTimings, 'hcmt tracker', global.loggers.trackers.metro)
})
