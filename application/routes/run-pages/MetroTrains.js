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
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)

  if (tripStartMinutes < 180) tripStartMinutes += 1440
  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440
  // if (tripStartMinutes >= 1440) tripDay.add(-1, 'day')
  // if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin + '-railway-station',
    'bays.mode': 'metro train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination + '-railway-station',
    'bays.mode': 'metro train'
  })

  if (!originStop || !destinationStop) return null

  let departureTime = tripStartMinutes
  let destinationArrivalTime = tripEndMinutes

  if (data.destination === 'flinders-street') {
    destinationArrivalTime = {
      $gte: tripEndMinutes - 3,
      $lte: tripEndMinutes + 3
    }
  }

  if (data.origin === 'flinders-street') {
    departureTime = {
      $gte: tripStartMinutes - 3,
      $lte: tripStartMinutes + 3
    }
  }

  let operationDays = utils.getYYYYMMDD(tripDay)

  let gtfsQuery = {
    $and: [{
      mode: 'metro train',
      operationDays
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: originStop.stopName,
          departureTimeMinutes: departureTime
        }
      }
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: destinationStop.stopName,
          arrivalTimeMinutes: destinationArrivalTime
        }
      }
    }]
  }

  if (originStop.stopName === 'Flinders Street Railway Station') {
    gtfsQuery.$and[0].direction = 'Down'
  }

  // NME, RMD shorts are always loaded live
  let liveTrips = await db.getCollection('live timetables').findDocuments(gtfsQuery).toArray()
  let gtfsTrips = await db.getCollection('gtfs timetables').findDocuments(gtfsQuery).toArray()

  let gtfsTrip, liveTrip
  let tripClosenessBound = trip => tripCloseness(trip, originStop, destinationStop, tripStartMinutes, tripEndMinutes)

  if (liveTrips.length > 1) {
    liveTrip = liveTrips.sort((a, b) => tripClosenessBound(a) - tripClosenessBound(b))[0]
  } else liveTrip = liveTrips[0]

  if (gtfsTrips.length > 1) {
    gtfsTrip = gtfsTrips.sort((a, b) => tripClosenessBound(a) - tripClosenessBound(b))[0]
  } else gtfsTrip = gtfsTrips[0]

  let referenceTrip = liveTrip || gtfsTrip
  let needsRedirect = referenceTrip ? (referenceTrip.origin !== originStop.stopName
    || referenceTrip.destination !== destinationStop.stopName
    || referenceTrip.departureTime !== data.departureTime
    || referenceTrip.destinationArrivalTime !== data.destinationArrivalTime) : false

  if (liveTrip) return { trip: liveTrip, tripStartTime, isLive: true, needsRedirect }
  else return { trip: gtfsTrip, tripStartTime, isLive: false, needsRedirect }
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
