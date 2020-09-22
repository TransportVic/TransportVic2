const tfnswAPI = require('./tfnsw-api')
const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables, liveTimetables, stops

async function fetchAndUpdate() {
  let dataSYDTrains = await tfnswAPI.makePBRequest('/v1/gtfs/realtime/sydneytrains')
  let sydTripDescriptors = dataSYDTrains.entity

  let relevantSYDTrips = sydTripDescriptors.map(trip => trip.trip_update).filter(trip => trip.trip.trip_id.match(/ST\d\d/) && trip.stop_time_update.length)

  await async.forEach(relevantSYDTrips, async trip => {
    let rawTripID = trip.trip.trip_id

    let gtfsTrip
    if (rawTripID.includes('.X.')) { // From SYD trains
      let updateTimestamp = utils.parseTime(trip.timestamp * 1000)
      gtfsTrip = await gtfsTimetables.findDocument({
        operationDays: utils.getYYYYMMDD(updateTimestamp),
        runID: rawTripID.slice(0, 4)
      })
    } else {
      let tripID = `${rawTripID.slice(-4)}.${rawTripID.slice(0, 4)}.${rawTripID.slice(5, -5)}.14-XPT`
      gtfsTrip = await gtfsTimetables.findDocument({ tripID })
    }

    let stopTimings = {}

    let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
    let tripStartTime = utils.minutesAftMidnightToMoment(startMinutes, utils.now())
    let minutesPastMidnight = utils.getMinutesPastMidnightNow()

    if (gtfsTrip.stopTimings.some(stop => stop.departureTimeMinutes > 1440) && minutesPastMidnight < startMinutes) { // Trip would be continuing on from previous day - so roll back a day
      tripStartTime.add(-1, 'day')
    }

    await async.forEach(trip.stop_time_update, async stop => {
      let stopGTFSID = parseInt(stop.stop_id.replace('P', '0')) + 140000000
      let stopData = await stops.findDocument({
        'bays.stopGTFSID': stopGTFSID
      })

      let platform = stopData.bays.find(bay => bay.stopGTFSID === stopGTFSID)
      stopTimings[stopData.stopName] = {
        departureDelay: (stop.departure || stop.arrival).delay * 1000,
        stopGTFSID
      }

      return stop
    })

    gtfsTrip.stopTimings = gtfsTrip.stopTimings.map((stop, i) => {
      let delayFactor = stopTimings[stop.stopName]
      if (delayFactor) {
        stop.stopGTFSID = delayFactor.stopGTFSID
      } else {
        let previousStop = gtfsTrip.stopTimings[i - 1]
        let nextStop = gtfsTrip.stopTimings[i + 1]

        if (previousStop && stopTimings[previousStop.stopName]) delayFactor = stopTimings[previousStop.stopName]
        else if (nextStop && stopTimings[nextStop.stopName]) delayFactor = stopTimings[nextStop.stopName]
      }

      if (delayFactor) {
        let minutesDiff = (stop.departureTimeMinutes || stop.arrivalTimeMinutes) - startMinutes
        let scheduledDepartureTime = tripStartTime.clone().add(minutesDiff, 'minutes')
        stop.estimatedDepartureTime = scheduledDepartureTime.add(delayFactor.departureDelay).toISOString()
      }

      return stop
    })

    gtfsTrip.type = 'timings'
    gtfsTrip.updateTime = new Date()
    gtfsTrip.operationDays = utils.getYYYYMMDD(tripStartTime)
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

  setInterval(fetchAndUpdate, 1000 * 60 * 2)
  await fetchAndUpdate()
})
