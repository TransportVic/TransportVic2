const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getVNETDepartures = require('../vline/get-vnet-departures')
const handleTripShorted = require('../vline/handle-trip-shorted')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let refreshRate = 30

function shouldRun() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 210 <= minutes && minutes <= 1260 // 0330 - 2100
}

async function getDeparturesFromVNET(db) {
  let vnetDepartures = [...await getVNETDepartures('', 'D', db), ...await getVNETDepartures('', 'U', db)]
  let vlineTrips = db.getCollection('vline trips')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  await async.forEach(vnetDepartures, async departure => {
    let referenceTime = departure.originDepartureTime.clone()
    if (referenceTime.get('hours') <= 3) referenceTime.add(-1, 'days')
    let date = utils.getYYYYMMDD(referenceTime)
    let dayOfWeek = utils.getDayName(referenceTime)

    let tripData = {
      date,
      runID: departure.runID,
      origin: departure.origin.slice(0, -16),
      destination: departure.destination.slice(0, -16),
      departureTime: departure.originDepartureTime.format('HH:mm'),
      destinationArrivalTime: departure.destinationArrivalTime.format('HH:mm'),
      consist: departure.vehicle,
    }

    if (departure.set) tripData.set = departure.set

    let query = {
      date, runID: departure.runID
    }

    await vlineTrips.replaceDocument(query, tripData, {
      upsert: true
    })

    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let trip
    let departureTime = departure.originDepartureTime
    let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime) % 1440

    for (let i = 0; i <= 1; i++) {
      let tripDay = departureTime.clone().add(-i, 'days')
      let query = {
        operationDays: utils.getYYYYMMDD(tripDay),
        mode: 'regional train',
        stopTimings: {
          $elemMatch: {
            stopName: departure.origin,
            departureTimeMinutes: scheduledDepartureTimeMinutes + 1440 * i
          }
        },
        destination: departure.destination
      }

      trip = await gtfsTimetables.findDocument(query)
      if (trip) break
    }

    if (!trip && nspTrip) trip = nspTrip

    await handleTripShorted(trip, departure, nspTrip, liveTimetables)
  })
}

async function requestTimings() {
  console.log('requesting vline trips')
  try {
    await getDeparturesFromVNET(database)
  } catch (e) {
    console.log(e)
    console.log('Error getting vline trips, skipping this round')
  }

  if (shouldRun()) {
    setTimeout(requestTimings, 30 * 60 * 1000)
  } else {
    let minutesPastMidnight = utils.getMinutesPastMidnightNow()
    let timeToStart = (1440 + 3 * 60 + 30 - minutesPastMidnight) % 1440

    setTimeout(requestTimings, timeToStart * 60 * 1000)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  await requestTimings()
})
