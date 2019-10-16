const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')

async function pickBestTrip(data, db) {
  data.mode = 'metro train'
  let tripDay = moment(data.operationDays, 'YYYYMMDD')
  let tripStartTime = moment.tz(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let operationHour = Math.floor(tripStartMinutes / 60)

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin + '-railway-station'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination + '-railway-station'
  })
  if (!originStop || !destinationStop) return null

  let query = {
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) return liveTrip
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')

  query.tripStartHour = { $lte: operationHour }
  query.tripEndHour = { $gte: operationHour }
  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)

  if (minutesToTripStart > 120 || minutesToTripStart < -80) { // later than 60min
    return gtfsTrip
  }

  let metroBay = originStop.bays.filter(bay => bay.mode === 'metro train')[0]
  let isoDeparture = tripStartTime.toISOString()
  let {departures, runs} = await ptvAPI(`/v3/departures/route_type/0/stop/${metroBay.stopGTFSID}?gtfs=true&date_utc=${tripStartTime.clone().add(-1, 'minutes').toISOString()}&max_results=3&expand=run&expand=stop`)

  let departure = departures.filter(departure => {
    let run = runs[departure.run_id]
    let destinationName = run.destination_name.trim()
    let scheduledDepartureTime = moment(departure.scheduled_departure_utc).toISOString()

    return scheduledDepartureTime === isoDeparture &&
      utils.encodeName(destinationName) === data.destination
  })[0]

  if (!departure) return null
  let ptvRunID = departure.run_id
  let departureTime = departure.scheduled_departure_utc

  return getStoppingPattern(db, ptvRunID, 'metro train', departureTime)
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await pickBestTrip(req.params, res.db)

  res.json(trip)
})

module.exports = router
