const tfnswAPI = require('./tfnsw-api')
const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables, liveTimetables, stops

async function fetchAndUpdate() {
  global.loggers.trackers.xpt.log('requesting xpt data')
  let dataSYDTrains = await tfnswAPI.makePBRequest('/v1/gtfs/realtime/sydneytrains')
  let dataNSWTrains = await tfnswAPI.makePBRequest('/v1/gtfs/realtime/nswtrains')
  let sydTripDescriptors = dataSYDTrains.entity
  let nswTripDescriptors = dataNSWTrains.entity

  let relevantSYDTrips = sydTripDescriptors.map(trip => trip.trip_update).filter(trip => trip.trip.trip_id.match(/ST\d\d/) && trip.stop_time_update.length)
  let relevantNSWTrips = nswTripDescriptors.map(trip => trip.trip_update).filter(trip => trip.trip.trip_id.match(/ST\d\d/) && trip.stop_time_update.length)

  let sydTrainIDs = relevantSYDTrips.map(trip => trip.trip.trip_id.slice(0, 4))
  let missingNSWTrips = relevantNSWTrips.filter(trip => !sydTrainIDs.includes(trip.trip.trip_id.slice(0, 4)))

  await async.forEach(relevantSYDTrips.concat(missingNSWTrips), async trip => {
    let rawTripID = trip.trip.trip_id
    let runID = rawTripID.slice(0, 4)

    let sydneyTrainsTrip = trip.stop_time_update
    let nswTrainsTrip = relevantNSWTrips.find(trip => trip.trip.trip_id.startsWith(runID))

    let gtfsTrip

    if (nswTrainsTrip && nswTrainsTrip.trip.start_date) {
      let knownQuery = { runID, operationDays: nswTrainsTrip.trip.start_date }
      gtfsTrip = await liveTimetables.findDocument(knownQuery) || await gtfsTimetables.findDocument(knownQuery)

      let startDate = utils.parseDate(nswTrainsTrip.trip.start_date)
      if (gtfsTrip) {
        let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
        tripStartTime = startDate.clone().add(startMinutes, 'minutes')
      }
    } else {
      let tripStartTime
      let yesterday = utils.now().add(-1, 'day').startOf('day')
      let yesterdayQuery = { runID, operationDays: utils.getYYYYMMDD(yesterday) }
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
      let todayQuery = { runID, operationDays: utils.getYYYYMMDDNow() }
      gtfsTrip = await liveTimetables.findDocument(todayQuery) || await gtfsTimetables.findDocument(todayQuery)

      let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
      tripStartTime = utils.now().startOf('day').add(startMinutes, 'minutes')
    }

    let timingUpdates = {}
    let platformUpdates = {}

    let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes

    async function parseStopTimeUpdates(stopTimeUpdates) {
      await async.forEach(stopTimeUpdates, async stop => {
        let stopGTFSID = parseInt(stop.stop_id.replace('P', '0')) + 140000000
        let stopData = await stops.findDocument({
          'bays.stopGTFSID': stopGTFSID
        })

        let delayFactor = (stop.departure || stop.arrival).delay * 1000
        if (delayFactor > 1000 * 60 * 60 * 24) delayFactor = 0
        timingUpdates[stopData.stopName] = delayFactor
        platformUpdates[stopData.stopName] = stopGTFSID
      })
    }

    await parseStopTimeUpdates(sydneyTrainsTrip)
    if (nswTrainsTrip) await parseStopTimeUpdates(nswTrainsTrip.stop_time_update)

    gtfsTrip.stopTimings.forEach((stop, i) => {
      let nextStop = gtfsTrip.stopTimings[i + 1]
      if (nextStop && !timingUpdates[nextStop.stopName]) {
        timingUpdates[nextStop.stopName] = timingUpdates[stop.stopName]
      }
    })

    gtfsTrip.stopTimings = gtfsTrip.stopTimings.map(stop => {
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

    gtfsTrip.type = 'timings'
    gtfsTrip.updateTime = new Date()
    gtfsTrip.operationDays = utils.getYYYYMMDD(tripStartTime)

    let consist = trip.vehicle

    if (!consist && nswTrainsTrip) consist = nswTrainsTrip.vehicle

    if (consist && consist.id) {
      let rawID = (consist.id || '').toString()
      if (rawID.match(/XP\d{4}/)) {
        gtfsTrip.consist = [rawID]
      }
    }

    let xptSize
    if (xptSize = rawTripID.match(/\.X\.(\d)\./)) {
      gtfsTrip.vehicle = `${xptSize[1]}x XPT`
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
