const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getMetroDepartures = require('../metro-trains/get-departures')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let liveTimetables, gtfsTimetables
let metroLocations
let metroTrips

async function findLocations() {
  let now = +new Date()
  let today = utils.getYYYYMMDD(utils.now())
  let yesterday = utils.getYYYYMMDD(utils.now().add(-1, 'day'))

  let old = await metroLocations.findDocuments({
    timestamp: {
      $lte: now - 1000 * 60 * 0,
      $gte: now - 1000 * 60 * 15
    }
  }).sort({ timestamp: 1 }).limit(30).toArray()

  let ids = []
  let deduped = old.filter(train => {
    let id = train.timestamp + train.location.coordinates.join('-')
    if (!ids.includes(id)) {
      ids.push(id)
      return true
    } else return false
  })

  let selected = utils.shuffle(deduped).slice(0, 8)

  await async.forEach(selected, async train => {
    let trips = await metroTrips.findDocuments({
      date: today,
      consist: train.consist[0]
    }).toArray()

    if (!trips.length) trips = await metroTrips.findDocuments({
      date: yesterday,
      consist: train.consist[0]
    }).toArray()

    let sorted = trips.map(trip => {
      let {departureTime, destinationArrivalTime, date} = trip

      let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)
      let destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)

      if (departureTimeMinutes < 180) departureTimeMinutes += 1440
      if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

      trip.tripEndTime = +utils.parseDate(date).add(destinationArrivalTimeMinutes, 'minutes')

      return trip
    }).sort((a, b) => a.tripEndTime - b.tripEndTime)

    let nextTrip = trips.find(trip => trip.tripEndTime > now) || trips[trips.length - 1]

    let timetable = await liveTimetables.findDocument({
      operationDays: nextTrip.date,
      runID: nextTrip.runID
    })

    if (!timetable) {
      timetable = await gtfsTimetables.findDocument({
        operationDays: nextTrip.date,
        trueDepartureTime: nextTrip.departureTime,
        trueOrigin: nextTrip.origin + ' Railway Station',
        trueDestination: nextTrip.destination + ' Railway Station',
        trueDestinationArrivalTime: nextTrip.destinationArrivalTime
      })
    }

    if (timetable) {
      let stopTimings = timetable.stopTimings.slice(0, -1)
      let originStop = stopTimings.find(stop => stop.stopName === timetable.trueOrigin)
      let tripDay = utils.parseDate(nextTrip.date)

      let nextStop = stopTimings.find(stop => {
        let departureTime = tripDay.clone().add(stop.departureTimeMinutes || stop.destinationArrivalTimeMinutes, 'minutes')
        return departureTime > now
      })

      let followingStop = stopTimings[stopTimings.indexOf(nextStop) + 1]
      let stopToUse = followingStop || nextStop || stopTimings[stopTimings.length - 1]

      if (stopToUse) {
        global.loggers.trackers.metro.info('Updating data for', train.consist, 'at', stopToUse.stopName.slice(0, -16))

        let stopData = await dbStops.findDocument({ stopName: stopToUse.stopName })
        let departures = await getMetroDepartures(stopData, database)
      }
    }
  })
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  liveTimetables = database.getCollection('live timetables')
  gtfsTimetables = database.getCollection('gtfs timetables')
  metroTrips = database.getCollection('metro trips')
  metroLocations = database.getCollection('metro locations')

  schedule([
    [0, 1440, 1],
  ], findLocations, 'metro locations', global.loggers.trackers.metro)
})
