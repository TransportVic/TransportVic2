const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')

function tripCloseness(trip, originStop, destinationStop, departureTimeMinutes, arrivalTimeMinutes) {
  let tripOrigin = trip.stopTimings.find(stop => stop.stopName === originStop.stopName)
  let tripDestination = trip.stopTimings.find(stop => stop.stopName === destinationStop.stopName)

  let originMinutes = tripOrigin.departureTimeMinutes % 1440
  let originDiff = Math.abs(originMinutes - departureTimeMinutes % 1440)

  let destMinutes = tripDestination.arrivalTimeMinutes % 1440
  let destDiff = Math.abs(destMinutes - arrivalTimeMinutes % 1440)

  let terminalsDiff = 0

  if (trip.trueOrigin === originStop.stopName) terminalsDiff++
  if (trip.trueDestination === destinationStop.stopName) terminalsDiff++

  return originDiff + destDiff - terminalsDiff
}

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

  // NME, RMD shorts are always loaded live
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

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) {
    global.loggers.general.err('Could not locate metro trip', req.url)
    return res.status(404).render('errors/no-trip')
  }

  let { trip, tripStartTime, isLive, needsRedirect } = tripData

  if (needsRedirect) {
    let operationDay = utils.getYYYYMMDD(tripStartTime)
    return res.redirect(`/metro/run/${utils.encodeName(trip.origin.slice(0, -16))}/${trip.departureTime}/${utils.encodeName(trip.destination.slice(0, -16))}/${trip.destinationArrivalTime}/${operationDay}`)
  }

  let trueOrigin = trip.stopTimings[0]
  let firstDepartureTime = trueOrigin.departureTimeMinutes

  let trackerData
  if (trip.runID) {
    let metroTrips = res.db.getCollection('metro trips')

    trackerData = await metroTrips.findDocument({
      date: utils.getYYYYMMDD(tripStartTime),
      runID: trip.runID
    })

    if (trackerData) trip.consist = trackerData.consist
  }

  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''

    if (trip.cancelled || stop.cancelled) {
      stop.headwayDevianceClass = 'cancelled'

      return stop
    } else {
      stop.headwayDevianceClass = 'unknown'
    }

    if (!isLive || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
      let estimatedDepartureTime = stop.estimatedDepartureTime

      stop.headwayDevianceClass = utils.findHeadwayDeviance(scheduledDepartureTime, estimatedDepartureTime, {
        early: 0.5,
        late: 5
      })

      if (isLive && !estimatedDepartureTime) return stop
      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
    }
    return stop
  })

  res.render('runs/metro', {
    trip,
    codedLineName: utils.encodeName(trip.routeName)
  })
})

module.exports = router
