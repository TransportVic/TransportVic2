const async = require('async')
const config = require('../../config')
const utils = require('../../utils.mjs')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getVNETDepartures = require('../vline-old/get-vnet-departures')
const handleTripShorted = require('../vline-old/handle-trip-shorted')
const findTrip = require('../vline-old/find-trip')
const { getDayOfWeek } = require('../../public-holidays.mjs')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function getDeparturesFromVNET(db) {
  let vnetDepartures = [
    ...await getVNETDepartures('', 'B', db, 1440, false, true),
    ...await getVNETDepartures('', 'B', db, 1440, true, true)
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
      try {
        await handleTripShorted(trip, departure, nspTrip, liveTimetables, departureDay)
      } catch (e) {
        global.loggers.oldTrackers.vline.err('Error cutting trip back', e, trip)
      }
    } else {
      global.loggers.oldTrackers.vline.err('Could not match trip', tripData)
    }

    if (trip && nspMatchedMethod === 'runID') {
      trip.runID = departure.runID
      trip.operationDays = departureDay

      delete trip._id


      try {
        await liveTimetables.replaceDocument({
          operationDays: departureDay,
          runID: departure.runID,
          mode: 'regional train'
        }, trip, {
          upsert: true
        })
      } catch (e) {
        global.loggers.oldTrackers.vline.err('Failed to update runid', e, departure.runID, trip)
      }
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

  // We still kinda want to keep this to watch for trip alterations and to view all trips
  await vlineTrips.bulkWrite(bulkOperations)
}

async function requestTimings() {
  global.loggers.oldTrackers.vline.info('requesting vline trips')
  try {
    await getDeparturesFromVNET(database)
  } catch (e) {
    global.loggers.oldTrackers.vline.err('Error getting vline trips, skipping this round', e)
  }
}

database.connect(async () => {
  schedule([
    [200, 240, 15], // Run it from 3am - 4am, taking into account website updating till ~3.30am
    [240, 1350, 20],
    [1350, 1440, 40]
  ], requestTimings, 'vline tracker', global.loggers.oldTrackers.vline)
})
