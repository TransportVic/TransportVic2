const express = require('express')
const moment = require('moment')
const async = require('async')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
const guessPlatform = require('../../../modules/vline/guess-scheduled-platforms')

function giveVariance(time) {
  let minutes = utils.getMinutesPastMidnightFromTime24(time)

  let validTimes = []
  for (let i = minutes - 5; i <= minutes + 5; i++) {
    validTimes.push(utils.getTime24FromMinutesPastMidnight(i))
  }

  return {
    $in: validTimes
  }
}

async function pickBestTrip(data, db) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required
  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440


  let stops = db.getCollection('stops')

  let originStop = await stops.findDocument({
    codedName: data.origin,
    'bays.mode': 'regional train'
  })
  let destinationStop = await stops.findDocument({
    codedName: data.destination,
    'bays.mode': 'regional train'
  })
  if (!originStop || !destinationStop) return null

  let variance = 8
  let destinationArrivalTime = {
    $gte: tripEndMinutes - variance,
    $lte: tripEndMinutes + variance
  }
  let departureTime = {
    $gte: tripStartMinutes - variance,
    $lte: tripStartMinutes + variance
  }

  let operationDays = data.operationDays
  if (tripStartMinutes > 1440) operationDays = utils.getYYYYMMDD(tripDay.clone().add(-1, 'day'))

  let query = {
    $and: [{
      mode: 'regional train',
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

  let referenceTrip

  let liveTrip = await db.getCollection('live timetables').findDocuments(query).toArray()
  function d(x) { return Math.abs(x.stopTimings[0].departureTimeMinutes - tripStartMinutes) }
  if (liveTrip.length) {
    if (liveTrip.length > 1) {
      referenceTrip = liveTrip.sort((a, b) => d(a) - d(b))[0]
    } else {
      referenceTrip = liveTrip[0]
    }
  } else {
    referenceTrip = await db.getCollection('gtfs timetables').findDocuments(query).toArray()
    if (referenceTrip.length) {
      if (referenceTrip.length > 1) {
        referenceTrip = referenceTrip.sort((a, b) => d(a) - d(b))[0]
      } else {
        referenceTrip = referenceTrip[0]
      }
    } else return null
  }

  let isXPT = referenceTrip.routeGTFSID === '14-XPT'
  let isLive = false

  if (isXPT && referenceTrip.updateTime) isLive = true

  let nspTrip
  if (!isXPT) {
    let vlineTrips = db.getCollection('vline trips')

    let trackerDepartureTime = giveVariance(referenceTrip.departureTime)
    let trackerDestinationArrivalTime = giveVariance(referenceTrip.destinationArrivalTime)

    let tripData = await vlineTrips.findDocument({
      date: operationDays,
      departureTime: trackerDepartureTime,
      origin: referenceTrip.origin.slice(0, -16),
      destination: referenceTrip.destination.slice(0, -16)
    })

    if (!tripData && referenceTrip.direction === 'Up') {
      tripData = await vlineTrips.findDocument({
        date: operationDays,
        departureTime: trackerDepartureTime,
        origin: referenceTrip.origin.slice(0, -16)
      })
    }

    if (!tripData) {
      tripData = await vlineTrips.findDocument({
        date: operationDays,
        destination: referenceTrip.destination.slice(0, -16),
        destinationArrivalTime: trackerDestinationArrivalTime
      })
    }

    if (tripData) {
        nspTrip = await db.getCollection('timetables').findDocument({
        mode: 'regional train',
        routeGTFSID: referenceTrip.routeGTFSID,
        runID: tripData.runID,
        operationDays: utils.getDayName(tripDay),
      })
    } else {
      nspTrip = await db.getCollection('timetables').findDocument({
        mode: 'regional train',
        origin: referenceTrip.origin,
        direction: referenceTrip.direction,
        routeGTFSID: referenceTrip.routeGTFSID,
        operationDays: utils.getDayName(tripDay),
        'stopTimings': {
          $elemMatch: {
            stopName: referenceTrip.origin,
            departureTimeMinutes: departureTime
          }
        }
      })
    }

    let {runID, vehicle} = nspTrip || {}

    referenceTrip.runID = runID
    referenceTrip.vehicle = vehicle

    if (tripData) {
      referenceTrip.runID = tripData.runID
      referenceTrip.consist = tripData.consist
    }
  }

  referenceTrip.stopTimings = await async.map(referenceTrip.stopTimings, async stop => {
    if (isXPT) {
      let stopData = await stops.findDocument({
        stopName: stop.stopName
      })

      let nswPlatform = stopData.bays.find(bay => bay.stopGTFSID === stop.stopGTFSID)

      let platformNumber = nswPlatform.originalName.match(/Platform (\d+)/)[1]
      stop.platform = platformNumber

      if (!referenceTrip.updateTime) stop.platform += '?'
    } else {
      let nspStop = nspTrip && nspTrip.stopTimings.find(nspStop => nspStop.stopGTFSID === stop.stopGTFSID && nspStop.platform)

      if (nspStop) {
        stop.platform = nspStop.platform + '?'
      } else {
        stop.platform = guessPlatform(stop.stopName.slice(0, -16), stop.departureTimeMinutes,
          referenceTrip.routeName, referenceTrip.direction)
        if (stop.platform) stop.platform += '?'
      }
    }

    return stop
  })

  return {
    trip: referenceTrip,
    tripStartTime,
    isLive
  }
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  let { trip, tripStartTime, isLive } = tripData

  let firstDepartureTime = trip.stopTimings[0].departureTimeMinutes
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''

    if (trip.cancelled || stop.cancelled) {
      stop.headwayDevianceClass = 'cancelled'

      return stop
    } else {
      stop.headwayDevianceClass = 'unknown'
    }

    if (!isLive || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
      if (stop.estimatedDepartureTime) {
        let headwayDeviance = scheduledDepartureTime.diff(stop.estimatedDepartureTime, 'minutes')

        if (headwayDeviance > 0) {
          stop.headwayDevianceClass = 'early'
        } else if (headwayDeviance <= -5) { // <= 5min counts as late
          stop.headwayDevianceClass = 'late'
        } else {
          stop.headwayDevianceClass = 'on-time'
        }
      }

      if (isLive && !stop.estimatedDepartureTime) return stop

      // TODO: Refactor
      let actualDepartureTime = stop.estimatedDepartureTime || scheduledDepartureTime
      let timeDifference = moment.utc(utils.parseTime(actualDepartureTime).diff(utils.now()))

      if (+timeDifference < -30000) return stop
      if (+timeDifference <= 60000) stop.prettyTimeToArrival = 'Now'
      else if (+timeDifference > 1440 * 60 * 1000) stop.prettyTimeToArrival = utils.getHumanDateShort(scheduledDepartureTime)
      else {
        stop.prettyTimeToArrival = ''
        if (timeDifference.get('hours')) stop.prettyTimeToArrival += timeDifference.get('hours') + ' h '
        if (timeDifference.get('minutes')) stop.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
      }
    }
    return stop
  })
  res.render('runs/vline', {trip})
})

module.exports = router
