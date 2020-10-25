const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getVNETDepartures = require('../vline/get-vnet-departures')
const handleTripShorted = require('../vline/handle-trip-shorted')
const findTrip = require('../vline/find-trip')
const { getDayOfWeek } = require('../../public-holidays')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function getDeparturesFromVNET(db) {
  let vnetDepartures = [
    ...await getVNETDepartures('', 'D', db, 1440), ...await getVNETDepartures('', 'U', db, 1440),
    ...await getVNETDepartures('', 'D', db, 1440, true), ...await getVNETDepartures('', 'U', db, 1440, true)
  ]

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

    let tripData = {
      date: departureDay,
      runID: departure.runID,
      origin: departure.origin.slice(0, -16),
      destination: departure.destination.slice(0, -16),
      departureTime: departure.originDepartureTime.format('HH:mm'),
      destinationArrivalTime: departure.destinationArrivalTime.format('HH:mm'),
      consist: departure.vehicle,
    }

    if (departure.set) tripData.set = departure.set

    await vlineTrips.replaceDocument({
      date: departureDay,
      runID: departure.runID
    }, tripData, {
      upsert: true
    })


    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let trip = (await liveTimetables.findDocument({
      operationDays: departureDay,
      runID: departure.runID,
      mode: 'regional train'
    })) || await findTrip(gtfsTimetables, departureDay, departure.origin, departure.destination, departureTimeHHMM)

    if (trip) {
      await handleTripShorted(trip, departure, nspTrip, liveTimetables, departureDay)
    }
  })
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
