const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')

function giveVariance(time) {
  let minutes = utils.time24ToMinAftMidnight(time)

  let validTimes = []
  for (let i = minutes - 5; i <= minutes + 5; i++) {
    validTimes.push(utils.minAftMidnightToTime24(i))
  }

  return {
    $in: validTimes
  }
}

async function pickBestTrip(data, db) {
  data.mode = 'regional train'
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin,
    'bays.mode': 'regional train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination,
    'bays.mode': 'regional train'
  })
  if (!originStop || !destinationStop) return null

  let variance = 5
  let destinationArrivalTime = {
    $gte: tripEndMinutes - variance,
    $lte: tripEndMinutes + variance
  }
  let departureTime = {
    $gte: tripStartMinutes - variance,
    $lte: tripStartMinutes + variance
  }

  let query = {
    $and: [{
      mode: 'regional train',
      operationDays: data.operationDays
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

  let referenceTrip

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) {
    referenceTrip = liveTrip
  } else {
    referenceTrip = await db.getCollection('gtfs timetables').findDocument(query)
    if (!referenceTrip) return null
  }

  let nspTrip = await db.getCollection('timetables').findDocument({
    mode: 'regional train',
    origin: referenceTrip.origin,
    destination: referenceTrip.destination,
    direction: referenceTrip.direction,
    routeGTFSID: referenceTrip.routeGTFSID,
    operationDays: utils.getDayName(tripDay),
    departureTime: referenceTrip.departureTime,
  })

  let {runID, vehicle} = nspTrip || {}

  let vlineTrips = db.getCollection('vline trips')

  let trackerDepartureTime = giveVariance(referenceTrip.departureTime)
  let trackerDestinationArrivalTime = giveVariance(referenceTrip.destinationArrivalTime)

  let tripData = await vlineTrips.findDocument({
    date: data.operationDays,
    departureTime: trackerDepartureTime,
    origin: referenceTrip.origin.slice(0, -16),
    destination: referenceTrip.destination.slice(0, -16)
  })

  if (!tripData) {
    tripData = await vlineTrips.findDocument({
      date: data.operationDays,
      departureTime: trackerDepartureTime,
      origin: referenceTrip.origin.slice(0, -16)
    })
  }

  if (!tripData) {
    tripData = await vlineTrips.findDocument({
      date: data.operationDays,
      destination: referenceTrip.destination.slice(0, -16),
      destinationArrivalTime: trackerDestinationArrivalTime
    })
  }

  referenceTrip.runID = runID
  referenceTrip.vehicle = vehicle

  if (tripData) {
    referenceTrip.runID = tripData.runID
    referenceTrip.consist = tripData.consist
  }

  return referenceTrip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await pickBestTrip(req.params, res.db)
  if (!trip) return res.status(404).render('errors/no-trip')

  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''

    let scheduledDepartureTime = utils.parseTime(req.params.operationDays, 'YYYYMMDD').add(stop.departureTimeMinutes || stop.arrivalTimeMinutes, 'minutes')

    const timeDifference = moment.utc(moment(scheduledDepartureTime).diff(utils.now()))

    if (+timeDifference < -30000) return stop
    if (+timeDifference <= 60000) stop.prettyTimeToArrival = 'Now'
    else {
      stop.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) stop.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) stop.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }
    return stop
  })
  res.render('runs/vline', {trip})
})

module.exports = router
