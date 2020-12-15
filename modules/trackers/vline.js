const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getVNETDepartures = require('../vline/get-vnet-departures')
const handleTripShorted = require('../vline/handle-trip-shorted')
const findTrip = require('../vline/find-trip')
const correctARTMBY = require('../vline/correct-art-mby')
const { getDayOfWeek } = require('../../public-holidays')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function getDeparturesFromVNET(db) {
  let vnetDepartures = [
    ...await getVNETDepartures('', 'B', db, 1440),
    ...await getVNETDepartures('', 'B', db, 1440, true)
  ]

  let vlineTrips = db.getCollection('vline trips')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let allTrips = {}

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

    trip = await correctARTMBY(departure, trip, gtfsTimetables, departureDay)

    let tripData = {
      date: departureDay,
      runID: departure.runID,
      origin: departure.origin.slice(0, -16),
      destination: departure.destination.slice(0, -16),
      departureTime: utils.formatHHMM(departure.originDepartureTime),
      destinationArrivalTime: utils.formatHHMM(departure.destinationArrivalTime),
      consist: departure.vehicle,
    }

    if (departure.set) tripData.set = departure.set

    if (trip) {
      await handleTripShorted(trip, departure, nspTrip, liveTimetables, departureDay)
    } else {
      global.loggers.trackers.vline.err('Could not match trip', tripData)
    }

    if (trip && nspMatchedMethod === 'runID') {
      trip.runID = departure.runID
      trip.operationDays = departureDay

      delete trip._id

      await liveTimetables.replaceDocument({
        operationDays: departureDay,
        runID: departure.runID,
        mode: 'regional train'
      }, trip, {
        upsert: true
      })
    }

    allTrips[departure.runID] = tripData
  })

  async function swap(mbyRun, artRun) {
    if (allTrips[mbyRun] || allTrips[artRun]) {
      let mby = allTrips[mbyRun], art = allTrips[artRun]
      let today = utils.getYYYYMMDDNow() // This would only activate at a reasonable hour of the day
      // In case one already departed eg 8118 usually leaves before 8116, but with TSRs we can't be sure

      let trueArtConsist, trueMbyConsist

      if (mby && mby.origin === 'Maryborough') trueArtConsist = mby.consist
      if (art && art.origin === 'Ararat') trueMbyConsist = art.consist

      if (!mby) {
        art = await vlineTrips.findDocument({ date: today, runID: artRun })
        if (art && art.origin === 'Ararat') trueArtConsist = art.consist
      }

      if (!art) {
        mby = await vlineTrips.findDocument({ date: today, runID: mbyRun })
        if (mby && mby.origin === 'Maryborough') trueMbyConsist = mby.consist
      }

      if (allTrips[mbyRun] && trueMbyConsist) allTrips[mbyRun].consist = trueMbyConsist
      if (allTrips[artRun] && trueArtConsist) allTrips[artRun].consist = trueArtConsist
    }
  }

  await swap('8118', '8116')
  await swap('8158', '8160')

  let bulkOperations = []
  Object.keys(allTrips).forEach(runID => {
    bulkOperations.push({
      replaceOne: {
        filter: { date: allTrips[runID].date, runID },
        replacement: allTrips[runID],
        upsert: true
      }
    })
  })

  // We still kinda want to keep this to watch for trip alterations, but since tracker data is all empty there's no point running this
  // await vlineTrips.bulkWrite(bulkOperations)
}

async function requestTimings() {
  global.loggers.trackers.vline.info('requesting vline trips')
  try {
    await getDeparturesFromVNET(database)
  } catch (e) {
    global.loggers.trackers.vline.err('Error getting vline trips, skipping this round', e)
  }
}

database.connect(async () => {
  schedule([
    [210, 1380, 10]
  ], requestTimings, 'vline tracker', global.loggers.trackers.vline)
})
