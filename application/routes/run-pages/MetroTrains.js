const express = require('express')
const router = new express.Router()
const utils = require('../../../utils.js')

async function pickBestTrip(data, db) {
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin + '-railway-station',
    'bays.mode': 'metro train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination + '-railway-station',
    'bays.mode': 'metro train'
  })

  if (!originStop || !destinationStop) return null

  let gtfsQuery = {
    mode: 'metro train',
    operationDays: data.operationDays,
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(gtfsQuery)
  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(gtfsQuery)

  let referenceTrip = liveTrip || gtfsTrip

  let needsRedirect = referenceTrip ? (referenceTrip.origin !== originStop.stopName
    || referenceTrip.destination !== destinationStop.stopName
    || referenceTrip.departureTime !== data.departureTime
    || referenceTrip.destinationArrivalTime !== data.destinationArrivalTime) : false

  if (liveTrip) return { trip: liveTrip, tripStartTime, isLive: true, needsRedirect }
  else return gtfsTrip ? { trip: gtfsTrip, tripStartTime, isLive: false, needsRedirect } : null
}

async function getTripData(req, res) {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return null

  let { trip, tripStartTime, isLive, needsRedirect } = tripData

  if (needsRedirect) {
    let operationDay = utils.getYYYYMMDD(tripStartTime)
    return res.redirect(`/metro/run/${utils.encodeName(trip.origin.slice(0, -16))}/${trip.departureTime}/${utils.encodeName(trip.destination.slice(0, -16))}/${trip.destinationArrivalTime}/${operationDay}`)
  }

  let hasLiveTimings = trip.stopTimings.some(stop => stop.estimatedDepartureTime)

  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''

    if (trip.cancelled || stop.cancelled) {
      stop.headwayDevianceClass = 'cancelled'

      return stop
    } else {
      stop.headwayDevianceClass = 'unknown'
    }

    if (!hasLiveTimings || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = utils.parseTime(stop.scheduledDepartureTime)
      let estimatedDepartureTime = utils.parseTime(stop.actualDepartureTimeMS)

      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
      if (!hasLiveTimings) return stop

      stop.headwayDevianceClass = utils.findHeadwayDeviance(scheduledDepartureTime, estimatedDepartureTime, {
        early: 0.5,
        late: 5
      })
    }
    return stop
  })

  return trip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/metro', {
    trip,
    codedLineName: utils.encodeName(trip.routeName)
  })
})

router.post('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/template/metro', {
    trip,
    codedLineName: utils.encodeName(trip.routeName)
  })
})

module.exports = router
