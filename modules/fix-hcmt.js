const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const getDepartures = require('../modules/metro-trains/get-departures')
const schedule = require('./trackers/scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = []

database.connect(async () => {
  let liveTimetables = database.getCollection('live timetables')
  let start = utils.now().startOf('day')

  let hcmt = await liveTimetables.findDocuments({
    operationDays: '20211003',
    h: true
  }).toArray()

  await async.forEach(hcmt, async trip => {
    trip.stopTimings.forEach(stop => {
      let time = stop.arrivalTimeMinutes
      let delay = null
      if (stop.estimatedDepartureTime) {
        delay = new Date(stop.estimatedDepartureTime) - new Date(stop.scheduledDepartureTime)
      }

      let sch = utils.getMomentFromMinutesPastMidnight(time, start)
      let est = delay ? sch.clone().add(delay, 'ms') : null
      let actual = +(est || sch)

      stop.arrivalTime = utils.formatHHMM(sch)
      stop.departureTime = stop.arrivalTime
      stop.scheduledDepartureTime = sch.toISOString()
      stop.estimatedDepartureTime = est ? est.toISOString() : null
      stop.actualDepartureTimeMS = actual
    })
    trip.departureTime = trip.stopTimings[0].departureTime
    trip.trueDepartureTime = trip.stopTimings[0].departureTime

    trip.destinationArrivalTime = trip.stopTimings[trip.stopTimings.length - 1].arrivalTime
    trip.trueDestinationArrivalTime = trip.stopTimings[trip.stopTimings.length - 1].arrivalTime
    await liveTimetables.replaceDocument({ _id: trip._id }, trip)
  })
  process.exit()
})
