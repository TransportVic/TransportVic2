const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getVNETDepartures = require('../vline/get-vnet-departures')
const handleTripShorted = require('../vline/handle-trip-shorted')
const findTrip = require('../vline/find-trip')
const { getDayOfWeek } = require('../../public-holidays')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let refreshRate = 10

function shouldRun() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 210 <= minutes && minutes <= 1380 // 0330 - 2300
}

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
    if (departureTimeMinutes < 300) {
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

    if (!trip && nspTrip) trip = nspTrip

    if (trip) {
      await handleTripShorted(trip, departure, nspTrip, liveTimetables, departureDay)
    }
  })
}

async function requestTimings() {
  console.log('requesting vline trips')
  try {
    await getDeparturesFromVNET(database)
  } catch (e) {
    console.error(e)
    console.log('Error getting vline trips, skipping this round')
  }

  if (shouldRun()) {
    setTimeout(requestTimings, refreshRate * 60 * 1000)
  } else {
    let minutesPastMidnight = utils.getMinutesPastMidnightNow()
    let timeToStart = (1440 + 3 * 60 + refreshRate - minutesPastMidnight) % 1440

    setTimeout(requestTimings, timeToStart * 60 * 1000)
  }
}

database.connect(async () => {
  await requestTimings()
})
