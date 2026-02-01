const tfnswAPI = require('./tfnsw-api')
const async = require('async')
const config = require('../../config')
const utils = require('../../utils.mjs')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables, liveTimetables, stops

async function fetchAndUpdate() {
  global.loggers.oldTrackers.xpt.log('requesting xpt data')
  let dataNSWTrains = await tfnswAPI.makePBRequest('/v1/gtfs/realtime/nswtrains')
  let nswTripDescriptors = dataNSWTrains.entity

  let relevantNSWTrips = nswTripDescriptors.map(trip => trip.trip_update).filter(trip => trip.trip.trip_id.match(/ST\d\d/) && trip.stop_time_update.length)

  await async.forEach(relevantNSWTrips, async trip => {
    let rawTripID = trip.trip.trip_id
    let runID = rawTripID.slice(0, 4)

    let stopTimeUpdates = trip.stop_time_update

    let gtfsTrip

    let tripStartTime

    if (trip && trip.trip.start_date) {
      let knownQuery = { runID, operationDays: trip.trip.start_date, mode: 'regional train' }
      gtfsTrip = await liveTimetables.findDocument(knownQuery) || await gtfsTimetables.findDocument(knownQuery)

      let startDate = utils.parseDate(trip.trip.start_date)
      if (gtfsTrip) {
        let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
        tripStartTime = startDate.clone().add(startMinutes, 'minutes')
      }
    } else {
      let yesterday = utils.now().add(-1, 'day').startOf('day')
      let yesterdayQuery = { runID, operationDays: utils.getYYYYMMDD(yesterday), mode: 'regional train' }
      let yesterdayTrip = await liveTimetables.findDocument(yesterdayQuery) || await gtfsTimetables.findDocument(yesterdayQuery)

      if (yesterdayTrip) {
        let yesterdayEndTime = yesterday.clone().add(yesterdayTrip.stopTimings.slice(-1)[0].arrivalTimeMinutes, 'minutes')
        if (utils.now() < yesterdayEndTime + 1000 * 60 * 60 * 5) { // Give it a buffer of 5 hours late?
          gtfsTrip = yesterdayTrip

          let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
          tripStartTime = yesterday.clone().add(startMinutes, 'minutes')
        }
      }
    }

    if (!gtfsTrip) {
      let todayQuery = { runID, operationDays: utils.getYYYYMMDDNow(), mode: 'regional train' }
      gtfsTrip = await liveTimetables.findDocument(todayQuery) || await gtfsTimetables.findDocument(todayQuery)

      let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
      tripStartTime = utils.now().startOf('day').add(startMinutes, 'minutes')
    }

    let timingUpdates = {}
    let platformUpdates = {}
    let stopsSkipped = []

    let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes

    async function parseStopTimeUpdates(stopTimeUpdates) {
      await async.forEach(stopTimeUpdates, async stop => {
        let stopGTFSID = 'XPT' + stop.stop_id
        let stopData = await stops.findDocument({
          'bays.stopGTFSID': stopGTFSID
        })

        let stopDelay = stop.departure || stop.arrival
        if (!stopDelay) return

        let delayFactor = stopDelay.delay * 1000
        if (delayFactor > 1000 * 60 * 60 * 24) delayFactor = 0
        timingUpdates[stopData.stopName] = delayFactor
        platformUpdates[stopData.stopName] = stopGTFSID

        if (stop.schedule_relationship === 1) stopsSkipped.push(stopData.stopName)
      })
    }

    await parseStopTimeUpdates(stopTimeUpdates)

    gtfsTrip.stopTimings.forEach((stop, i) => {
      let nextStop = gtfsTrip.stopTimings[i + 1]
      if (nextStop && !timingUpdates[nextStop.stopName]) {
        timingUpdates[nextStop.stopName] = timingUpdates[stop.stopName]
      }
    })

    gtfsTrip.stopTimings = gtfsTrip.stopTimings.filter(stop => {
      return !stopsSkipped.includes(stop.stopName)
    }).map(stop => {
      let delayFactor = timingUpdates[stop.stopName]
      let newPlatform = platformUpdates[stop.stopName]

      if (newPlatform) {
        stop.stopGTFSID = newPlatform
      }

      if (typeof delayFactor !== 'undefined') {
        let minutesDiff = (stop.departureTimeMinutes || stop.arrivalTimeMinutes) - startMinutes
        let scheduledDepartureTime = tripStartTime.clone().add(minutesDiff, 'minutes')
        stop.estimatedDepartureTime = scheduledDepartureTime.add(delayFactor).toISOString()
        stop.actualDepartureTimeMS = +scheduledDepartureTime
      }

      return stop
    })

    let first = gtfsTrip.stopTimings[0]
    let last = gtfsTrip.stopTimings.slice(-1)[0]

    first.arrivalTime = null
    first.arrivalTimeMinutes = null

    last.departureTime = null
    last.departureTimeMinutes = null

    gtfsTrip.origin = first.stopName
    gtfsTrip.departureTime = first.departureTime

    gtfsTrip.destination = last.stopName
    gtfsTrip.destinationArrivalTime = last.arrivalTime

    gtfsTrip.type = 'timings'
    gtfsTrip.updateTime = new Date()
    gtfsTrip.operationDays = utils.getYYYYMMDD(tripStartTime)

    let consist = trip.vehicle

    if (!consist && trip) consist = trip.vehicle

    if (consist && consist.id) {
      let rawID = (consist.id || '').toString()
      if (rawID.match(/XP\d{4}/)) {
        gtfsTrip.consist = [rawID]
      }
    }

    delete gtfsTrip._id

    let key = {
      mode: 'regional train',
      routeGTFSID: '14-XPT',
      operationDays: gtfsTrip.operationDays,
      departureTime: gtfsTrip.departureTime,
      origin: gtfsTrip.origin,
      destinationArrivalTime: gtfsTrip.destinationArrivalTime
    }

    await liveTimetables.replaceDocument(key, gtfsTrip, {
      upsert: true
    })
  })
}

database.connect(async () => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  liveTimetables = database.getCollection('live timetables')
  stops = database.getCollection('stops')

  setInterval(fetchAndUpdate, 1000 * 30)
  await fetchAndUpdate()
})
