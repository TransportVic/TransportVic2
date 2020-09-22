const tfnswAPI = require('./tfnsw-api')
const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables, stops

async function fetchAndUpdate() {
  let data = await tfnswAPI.makePBRequest('/v1/gtfs/realtime/nswtrains')
  let tripDescriptors = data.entity

  let relevantTrips = tripDescriptors.map(trip => trip.trip_update).filter(trip => trip.trip.route_id.startsWith('4T.T.ST'))

  await async.forEach(relevantTrips, async trip => {
    let rawTripID = trip.trip.trip_id
    let tripID = `${rawTripID.slice(-4)}.${rawTripID.slice(0, 4)}.${rawTripID.slice(5, -5)}.14-XPT`

    let gtfsTrip = await gtfsTimetables.findDocument({ tripID })
    let stopTimings = {}

    let startMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes
    let tripStartTime = utils.minutesAftMidnightToMoment(startMinutes, utils.now())

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
        let minutesDiff = (stop.departureTimeMinutes || stop.departureTimeMinutes) - startMinutes
        let scheduledDepartureTime = tripStartTime.clone().add(minutesDiff, 'minutes')
        stop.estimatedDepartureTime = scheduledDepartureTime.add(-delayFactor.departureDelay).toISOString()
      }

      return stop
    })

    gtfsTrip.type = 'timings'
    gtfsTrip.updateTime = new Date()
    gtfsTrip.operationDays = utils.getYYYYMMDD(tripStartTime)
    delete gtfsTrip._id
  })
}

database.connect(async () => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  stops = database.getCollection('stops')

  setInterval(fetchAndUpdate, 1000 * 60 * 2)
  await fetchAndUpdate()
})
