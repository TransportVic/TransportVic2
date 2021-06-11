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
let liveTimetables, timetables

async function getTimetable() {
  let pakenham = await utils.getData('metro-op-timetable', '92', async () => {
    return JSON.parse(await utils.request(urls.op.format('92'), { timeout: 10000 }))
  }, 1000 * 60 * 12)

  let cranbourne = await utils.getData('metro-op-timetable', '86', async () => {
    return JSON.parse(await utils.request(urls.op.format('86'), { timeout: 10000 }))
  }, 1000 * 60 * 12)

  return pakenham.concat(cranbourne)
}

async function requestMetroData() {
  let data = JSON.parse(await utils.request(urls.hcmt, { timeout: 10000 }))
  return data.entries
}

async function createStop(prevStop, minutesDiff, stopName, platform) {
  let stopData = await dbStops.findDocument({ stopName })
  let metroBay = stopData.bays.find(bay => bay.mode === 'metro train')
  let prevScheduled = utils.parseTime(prevStop.scheduledDepartureTime)
  let prevEstimated = prevStop.estimatedDepartureTime ? utils.parseTime(prevStop.estimatedDepartureTime) : null

  let newScheduled = prevScheduled.clone().add(minutesDiff, 'minutes')
  let scheduledTime = utils.formatHHMM(newScheduled)
  let newEstimated = prevEstimated ? prevEstimated.clone().add(minutesDiff, 'minutes') : null
  let estimatedISO = newEstimated ? newEstimated.toISOString() : null

  return {
    stopName: stopName,
    stopNumber: null,
    suburb: metroBay.suburb,
    stopGTFSID: metroBay.stopGTFSID,
    arrivalTime: scheduledTime,
    arrivalTimeMinutes: prevStop.departureTimeMinutes + minutesDiff,
    departureTime: scheduledTime,
    departureTimeMinutes: prevStop.departureTimeMinutes + minutesDiff,
    estimatedDepartureTime: estimatedISO,
    actualDepartureTimeMS: +newEstimated,
    scheduledDepartureTime: newScheduled.toISOString(),
    platform,
    stopConditions: { pickup: "0", dropoff: "0" }
  }
}

async function appendLastStop(trip) {
  if (trip.direction === 'Down') { // Last stop given OFC/CDA
    prevStop = trip.stopTimings[trip.stopTimings.length - 1]

    if (prevStop && prevStop.stopName === 'Officer Railway Station') {
      let cdaStop = await createStop(prevStop, 3, 'Cardinia Road Railway Station', '2')
      trip.stopTimings.push(cdaStop)
      prevStop = cdaStop
    }

    if (prevStop && prevStop.stopName === 'Cardinia Road Railway Station') {
      trip.stopTimings.push(await createStop(prevStop, 6, 'Pakenham Railway Station', '1'))
    }

    // DNG trips only
    if (prevStop && prevStop.stopName === 'Yarraman Railway Station') {
      let dngStop = await createStop(prevStop, 4, 'Dandenong Railway Station', '2')
      trip.stopTimings.push(dngStop)
    }
  }
}

async function appendNewData(existingTrip, trip, stopDescriptors, startOfDay) {
  existingTrip.stopTimings.forEach(stop => {
    let updatedData = stopDescriptors.find(newStop => stop.stopName.includes(newStop.station))

    if (updatedData) {
      stop.estimatedDepartureTime = startOfDay.clone().add(updatedData.estimated_departure_time_seconds, 'seconds')
      stop.platform = updatedData.estimated_platform
    }
  })

  existingTrip.stopTimings.forEach((stop, i) => {
    if (i !== 0 && stop.estimatedDepartureTime) {
      let previousStop = existingTrip.stopTimings[i - 1]
      if (stop.estimatedDepartureTime < previousStop.estimatedDepartureTime) {
        stop.estimatedDepartureTime.add(1, 'day')
      }
    }
  })

  existingTrip.stopTimings.forEach(stop => {
    if (stop.estimatedDepartureTime && stop.estimatedDepartureTime.toISOString) { // If it is an existing value it is already a string
      stop.actualDepartureTimeMS = +stop.estimatedDepartureTime
      stop.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()
    }
  })

  let existingLastStop = existingTrip.destination
  let index = stopDescriptors.findIndex(stop => existingLastStop.includes(stop.station))

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
      cancelled: trip.stopsAvailable[0].cancelled
    }
  })
}

async function mapStops(stops, stopDescriptors, startOfDay) {
  let allStops = await async.map(stops, async stop => {
    let stopData = await dbStops.findDocument({ stopName: stop.stopName })
    let metroBay = stopData.bays.find(bay => bay.mode === 'metro train')

    let scheduledTime = utils.formatHHMM(stop.scheduledDepartureTime)
    let departureData = stopDescriptors.find(stopDescriptor => stop.stopName.startsWith(stopDescriptor.station))
    let estimatedDepartureTime, platform = stop.platform

    if (departureData) {
      estimatedDepartureTime = startOfDay.clone().add(departureData.estimated_departure_time_seconds, 'seconds')
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

  allStops.forEach((stop, i) => {
    if (i !== 0 && stop.estimatedDepartureTime) {
      let previousStop = allStops[i - 1]
      if (stop.estimatedDepartureTime < previousStop.estimatedDepartureTime) {
        stop.estimatedDepartureTime.add(1, 'day')
      }
    }
  })

  allStops.forEach(stop => {
    if (stop.estimatedDepartureTime) {
      stop.actualDepartureTimeMS = +stop.estimatedDepartureTime
      stop.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()
    }
  })

  return allStops
}

async function createTrip(trip, stopDescriptors, startOfDay) {
  let stopTimings = await mapStops(trip.stopsAvailable, stopDescriptors, startOfDay)

  let baseTrip = {
    stopTimings,
    direction: trip.direction
  }

  await appendLastStop(baseTrip)

  let firstStop = baseTrip.stopTimings[0]
  let lastStop = baseTrip.stopTimings[baseTrip.stopTimings.length - 1]

  let timetable = {
    mode: 'metro train',
    routeName: 'Pakenham',
    routeGTFSID: '2-PKM',
    runID: trip.runID,
    forming: trip.forming === '0' ? null : trip.forming,
    operationDays: trip.operationDays,
    vehicle: {
      size: '7',
      type: 'HCMT',
      consist: [],
    },
    stopTimings: baseTrip.stopTimings,
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
    cancelled: trip.stopsAvailable[0].cancelled,
    h: true
  }

  await liveTimetables.createDocument(timetable)
}

function parseRawData(stop, startOfDay) {
  let scheduledDepartureTime = startOfDay.clone().add(stop.time_seconds, 'seconds')

  return {
    stopName: stop.station + ' Railway Station',
    stopSeconds: stop.time_seconds,
    scheduledDepartureTime,
    scheduledDepartureMinutes: Math.round(parseInt(stop.time_seconds) / 60),
    platform: stop.platform,
    cancelled: stop.status === 'C'
  }
}

async function checkTrip(trip, stopDepartures, startOfDay, day, now) {
  let existingTrip = await liveTimetables.findDocument({
    operationDays: day,
    runID: trip.runID
  })

  let stopDescriptors = stopDepartures.filter(stop => stop.trip_id === trip.runID).sort((a, b) => a.time_seconds - b.time_seconds)

  if (existingTrip) {
    if (existingTrip.h) {
      await appendNewData(existingTrip, trip, stopDescriptors, startOfDay)
    }
  } else {
    global.loggers.trackers.metro.log('[HCMT]: Identified HCMT Trip #' + trip.runID)
    await createTrip(trip, stopDescriptors, startOfDay)
  }
}

async function getDepartures() {
  let timetable = await getTimetable()

  // Tracker only runs at reasonable times, no 3am to worry about
  let startOfDay = utils.now().startOf('day')
  let day = utils.getYYYYMMDD(startOfDay)
  let now = utils.now()
  let dayOfWeek = await getDayOfWeek(now)
  let metroDay = startOfDay.format('YYYY-MM-DD')

  let tripsToday = timetable.filter(trip => {
    return trip.date === metroDay
  })

  let stopDepartures = await requestMetroData()

  let allTrips = Object.values(tripsToday.reduce((trips, stop) => {
    let runID = stop.trip_id
    if (!trips[runID]) trips[runID] = {
      runID: runID,
      forming: stop.forms_trip_id,
      stopsAvailable: [],
      direction: runID[3] % 2 === 0 ? 'Up' : 'Down',
      operationDays: day
    }

    trips[runID].stopsAvailable.push(parseRawData(stop, startOfDay))

    return trips
  }, {})).filter(trip => trip.stopsAvailable[0].stopSeconds < 86400)
  // Filter as we can get trips for just past 3am for the next day and obv it won't match

  let pakenhamRunIDs = (await ptvAPI(`/v3/runs/route/11`)).runs.filter(run => {
    return run.run_id >= 948000
  }).map(run => utils.getRunID(run.run_id))
  let cranbourneRunIDs = (await ptvAPI(`/v3/runs/route/4`)).runs.filter(run => {
    return run.run_id >= 948000
  }).map(run => utils.getRunID(run.run_id))

  let allPTVRunIDs = pakenhamRunIDs.concat(cranbourneRunIDs)

  // // PTV Doesnt have it, likely to be HCMT
  let missingTrips = allTrips.filter(trip => !allPTVRunIDs.includes(trip.runID))

  let formingRunIDs = missingTrips.map(trip => trip.forming)
  let missingFormings = allTrips.filter(trip => formingRunIDs.includes(trip.runID) && !missingTrips.includes(trip))

  let missingFormedBy = missingTrips.map(trip => {
    let { runID } = trip
    let tripForming = allTrips.find(formedBy => formedBy.forming === runID)
    if (!missingTrips.includes(tripForming)) return tripForming
    else return null
  }).filter(Boolean)

  let allMissingTrips = missingTrips.concat(missingFormings).concat(missingFormedBy)

  await async.forEach(allMissingTrips, async trip => {
    await checkTrip(trip, stopDepartures, startOfDay, day, now)
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
  timetables = database.getCollection('timetables')

  schedule([
    [180, 240, 15], // Run it from 3am - 4am, taking into account website updating till ~3.30am
    [240, 360, 6],
    [360, 1199, 3],
    [1200, 1380, 4],
    [1380, 1439, 6]
  ], requestTimings, 'hcmt tracker', global.loggers.trackers.metro)
})
