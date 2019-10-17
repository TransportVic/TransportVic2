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
  let tripEndTime = moment.tz(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  let operationHour = Math.floor(tripStartMinutes / 60)

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin + '-railway-station'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination + '-railway-station'
  })
  if (!originStop || !destinationStop) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')

  let query = {
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let useLive = tripEndMinutes > -5 && minutesToTripStart < 120

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip && useLive) {
    liveTrip.destination = liveTrip.destination.slice(0, -16)
    liveTrip.origin = liveTrip.origin.slice(0, -16)
    return liveTrip
  }
  query.tripStartHour = { $lte: operationHour }
  query.tripEndHour = { $gte: operationHour }
  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)

  if (gtfsTrip && !useLive) {
    gtfsTrip.destination = gtfsTrip.destination.slice(0, -16)
    gtfsTrip.origin = gtfsTrip.origin.slice(0, -16)

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
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''

    stop.headwayDevianceClass = 'unknown'
    if (stop.estimatedDepartureTime) {
      let scheduledDepartureTime =
        moment.tz(`${req.params.operationDays} ${stop.departureTime || stop.arrivalTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
      let headwayDeviance = scheduledDepartureTime.diff(stop.estimatedDepartureTime, 'minutes')

      // trains cannot be early
      let lateThreshold = 5
      if (headwayDeviance <= -lateThreshold) { // <= 5min counts as late
        stop.headwayDevianceClass = 'late'
      } else {
        stop.headwayDevianceClass = 'on-time'
      }

      const timeDifference = moment.utc(moment(stop.estimatedDepartureTime).diff(utils.now()))

      if (+timeDifference < -30000) return stop
      if (+timeDifference <= 60000) stop.prettyTimeToArrival = 'Now'
      else {
        stop.prettyTimeToArrival = ''
        if (timeDifference.get('hours')) stop.prettyTimeToArrival += timeDifference.get('hours') + ' h '
        if (timeDifference.get('minutes')) stop.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
      }
    }
    return stop
  })
  res.render('runs/metro', {trip})
})

module.exports = router
