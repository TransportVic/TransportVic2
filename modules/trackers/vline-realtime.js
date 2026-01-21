const async = require('async')
const config = require('../../config')
const utils = require('../../utils.mjs')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')
const findTrip = require('../vline-old/find-trip')
const getVNETDepartures = require('../vline-old/get-vnet-departures')
const schedule = require('./scheduler')
const vlineLock = require('../vline-old/vline-lock-wrap')
const { getDayOfWeek } = require('../../public-holidays.mjs')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let stops = [
  'North Geelong',
  'Tarneit',
  'Footscray',
  'Marshall',
  'Rockbank',
  'Melton',
  'Ballarat',
  'Kangaroo Flat',
  'Woodend',
  'Sunbury',
  'Dandenong',
  'Pakenham',
  'Warragul',
  'Morwell',
  'Flinders Street',
  'Broadmeadows',
  'Wallan',
  'Tallarook'
]

let extendedList = [
  'Stratford',
  'Tallarook',
  'Mooroopna',
  'Rochester',
  'Kerang',
  'Terang',
  'Winchelsea',
  'North Melbourne',
  'Watergardens',
  'Wangaratta',
  'Wodonga',
  'Avenel',
  'Violet Town',
  'Beaufort',
  'Talbot',
  'Creswick'
]

async function getDeparturesFromVNET(db, station) {
  let vnetName = station.bays.find(bay => bay.vnetStationName).vnetStationName

  let vnetDepartures = await getVNETDepartures(vnetName, 'B', db, 1440, true, true)

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  return (await async.map(vnetDepartures, async departure => {
    let departureDay = utils.getYYYYMMDD(departure.originDepartureTime)
    let departureTimeHHMM = utils.formatHHMM(departure.originDepartureTime)

    let departureTimeMinutes = utils.getMinutesPastMidnight(departure.originDepartureTime)
    if (departureTimeMinutes < 180) departureDay = utils.getYYYYMMDD(departure.originDepartureTime.clone().add(-1, 'day'))

    let trip = (await liveTimetables.findDocument({
      operationDays: departureDay,
      runID: departure.runID,
      mode: 'regional train'
    })) || await findTrip(gtfsTimetables, departureDay, departure.origin, departure.destination, departureTimeHHMM)

    // Will we be able to correct the trip timings for ART-MBY? Probably not.

    departure.trip = trip

    if (trip) {
      let stopTiming = trip.stopTimings.find(stop => stop.stopName === station.stopName)
      let originTiming = trip.stopTimings.find(stop => stop.stopName === departure.origin)

      if (!stopTiming) return null

      let minutesDifference = (stopTiming.arrivalTimeMinutes || stopTiming.departureTimeMinutes) - originTiming.departureTimeMinutes

      let scheduledDepartureTime = departure.originDepartureTime.clone().add(minutesDifference, 'minutes')
      let estimatedArrivalTime = departure.estimatedStopArrivalTime

      let delay = estimatedArrivalTime - scheduledDepartureTime
      departure.delay = delay
      departure.stopTiming = stopTiming

      trip.runID = departure.runID
      trip.operationDays = departureDay
      delete trip._id
    }

    return departure
  })).filter(departure => departure && departure.trip)
}


async function fetchData() {
  let dbStops = await database.getCollection('stops')
  let liveTimetables = await database.getCollection('live timetables')

  let trips = {}
  let tripDepartureTimes = {}
  let combinedTripData = {}

  let stopList = stops
  let minutes = utils.getMinutesPastMidnightNow()

  if (450 <= minutes && minutes <= 1410) { // 7.30am - 11.30pm
    stopList = stopList.concat(extendedList)
  }

  await async.forEachSeries(stopList, async stop => {
    let stopData = await dbStops.findDocument({ stopName: stop + ' Railway Station' })
    let departures = await getDeparturesFromVNET(database, stopData)
    departures.forEach(departure => {
      let {runID} = departure
      if (!combinedTripData[runID]) {
        combinedTripData[runID] = {}
        trips[runID] = departure.trip
        tripDepartureTimes[runID] = {
          moment: departure.originDepartureTime,
          minutes: departure.trip.stopTimings.find(stop => stop.stopName === departure.origin).departureTimeMinutes
        }
      }

      let {stopTiming, delay} = departure
      combinedTripData[runID][stopTiming.stopName] = delay

      let destinationTiming = departure.trip.stopTimings.find(stop => stop.stopName === departure.destination)
      if (!destinationTiming) return global.loggers.general.warn('Destination mismatch!', departure)
      combinedTripData[runID][destinationTiming.stopName] = departure.estimatedDestArrivalTime - departure.destinationArrivalTime
    })

    await utils.sleep(500)
  })

  try {
    vlineLock.createLock()
    await async.forEach(Object.keys(combinedTripData), async runID => {
      let stopDelays = combinedTripData[runID]
      let trip = trips[runID]

      let tripStops = trip.stopTimings.map(stop => stop.stopName)
      let orderedStops = Object.keys(stopDelays).map(stop => [stop, tripStops.indexOf(stop)])
        .sort((a, b) => a[1] - b[1]).map(stop => stop[0])

      let tripDepartureTime = tripDepartureTimes[runID]

      orderedStops.forEach((stop, i) => {
        if (i === 0) return
        let previous = orderedStops[i - 1]

        let currentDelay = stopDelays[stop]
        let previousDelay = stopDelays[previous]

        let delayDifference = currentDelay - previousDelay

        let previousIndex = tripStops.indexOf(previous)
        let currentIndex = tripStops.indexOf(stop)
        let relevantStops = trip.stopTimings.slice(previousIndex, currentIndex + 1)

        let previousMinutes = trip.stopTimings[previousIndex].departureTimeMinutes
        let currentStopData = trip.stopTimings[currentIndex]
        let currentMinutes = (currentStopData.departureTimeMinutes || currentStopData.arrivalTimeMinutes)

        let minutesDifference = currentMinutes - previousMinutes

        relevantStops.forEach(stop => {
          let stopMinutes = (stop.departureTimeMinutes || stop.arrivalTimeMinutes)
          let minutesFromPrevious = stopMinutes - previousMinutes
          let minutesPercentage = minutesFromPrevious / minutesDifference
          let delayPercentage = minutesPercentage * delayDifference

          let minutesFromOrigin = stopMinutes - tripDepartureTime.minutes
          let scheduledDepartureTime = tripDepartureTime.moment.clone().add(minutesFromOrigin, 'minutes')
          let estimatedDepartureTime = scheduledDepartureTime.clone().add(previousDelay + delayPercentage, 'milliseconds')

          stop.estimatedDepartureTime = estimatedDepartureTime.toISOString()
          stop.actualDepartureTimeMS = +estimatedDepartureTime
        })
      })

      await liveTimetables.replaceDocument({
        operationDays: trip.operationDays,
        runID: trip.runID,
        mode: 'regional train'
      }, trip, {
        upsert: true
      })
    })
  } finally {
    vlineLock.releaseLock()
  }
}

async function fetchPlatforms(db) {
  try {
    vlineLock.createLock()
    let vnetDepartures = await getVNETDepartures('Melbourne, Southern Cross', 'B', db, 1440)

    let vlineTrips = db.getCollection('vline trips')
    let timetables = db.getCollection('timetables')
    let liveTimetables = db.getCollection('live timetables')
    let gtfsTimetables = db.getCollection('gtfs timetables')

    await async.forEach(vnetDepartures, async departure => {
      let departureDay = utils.getYYYYMMDD(departure.originDepartureTime)
      let departureTimeHHMM = utils.formatHHMM(departure.originDepartureTime)
      let dayOfWeek = await getDayOfWeek(departure.originDepartureTime)

      let departureTimeMinutes = utils.getMinutesPastMidnight(departure.originDepartureTime)
      if (departureTimeMinutes < 180) {
        let previousDay = departure.originDepartureTime.clone().add(-1, 'day')
        departureDay = utils.getYYYYMMDD(previousDay)
        dayOfWeek = await getDayOfWeek(previousDay)
      }

      let nspMatchedMethod = 'unknown'
      let nspTrip = await findTrip(timetables, dayOfWeek, departure.origin, departure.destination, departureTimeHHMM)

      if (nspTrip) nspMatchedMethod = 'time'
      else {
        nspTrip = await timetables.findDocument({
          operationDays: dayOfWeek,
          runID: departure.runID,
          mode: 'regional train'
        })

        if (nspTrip) nspMatchedMethod = 'runID'
      }

      let trip = await liveTimetables.findDocument({
        operationDays: departureDay,
        runID: departure.runID,
        mode: 'regional train'
      }) || await findTrip(gtfsTimetables, departureDay, departure.origin, departure.destination, departureTimeHHMM)

      if (!trip && nspTrip) {
        trip = await findTrip(gtfsTimetables, departureDay, nspTrip.origin, nspTrip.destination, nspTrip.departureTime)
      }

      if (trip) {
        trip.runID = departure.runID
        trip.operationDays = departureDay

        delete trip._id

        let sssStop = trip.stopTimings.find(stop => stop.stopName === 'Southern Cross Railway Station')
        if (sssStop) {
          sssStop.platform = departure.platform
          sssStop.livePlatform = true
        }

        await liveTimetables.replaceDocument({
          operationDays: departureDay,
          runID: departure.runID,
          mode: 'regional train'
        }, trip, {
          upsert: true
        })
      }
    })
  } finally {
    vlineLock.releaseLock()
  }
}

let cycleCount = 0

async function requestTimings() {
  cycleCount++

  try {
    if (cycleCount === 1) {
      global.loggers.oldTrackers.vlineR.info('requesting vline realtime data')
      await fetchData()
    }

    global.loggers.oldTrackers.vlineR.info('requesting vline platform data')
    await fetchPlatforms(database)
  } catch (e) {
    global.loggers.oldTrackers.vlineR.err('Error getting vline realtime data, skipping this round', e)
  }

  if (cycleCount === 5) cycleCount = 0
}

database.connect(async () => {
  schedule([
    [0, 120, 3],
    [330, 1440, 2]
  ], requestTimings, 'vline-r tracker', global.loggers.oldTrackers.vlineR)
})
