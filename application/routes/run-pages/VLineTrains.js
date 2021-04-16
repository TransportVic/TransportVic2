const express = require('express')
const moment = require('moment')
const async = require('async')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
const guessPlatform = require('../../../modules/vline/guess-scheduled-platforms')
const findTrip = require('../../../modules/vline/find-trip')
const { getDayOfWeek } = require('../../../public-holidays')

function giveVariance(time) {
  let minutes = utils.getMinutesPastMidnightFromHHMM(time)

  let validTimes = []
  for (let i = minutes - 5; i <= minutes + 5; i++) {
    validTimes.push(utils.getHHMMFromMinutesPastMidnight(i))
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

  let operationDays = data.operationDays
  if (tripStartMinutes > 1440) operationDays = utils.getYYYYMMDD(tripDay.add(-1, 'day'))

  let liveTrip = await findTrip(db.getCollection('live timetables'), operationDays, originStop.stopName, destinationStop.stopName, data.departureTime)
  let gtfsTrip = await findTrip(db.getCollection('gtfs timetables'), operationDays, originStop.stopName, destinationStop.stopName, data.departureTime)
  let referenceTrip

  if (liveTrip && !gtfsTrip) referenceTrip = liveTrip
  else if (gtfsTrip && !liveTrip) referenceTrip = gtfsTrip
  else if (liveTrip && gtfsTrip) {
    let liveDiff = Math.abs(liveTrip.stopTimings[0].departureTimeMinutes - tripStartMinutes)
    let gtfsDiff = Math.abs(gtfsTrip.stopTimings[0].departureTimeMinutes - tripStartMinutes)
    if (liveDiff <= gtfsDiff) referenceTrip = liveTrip
    else referenceTrip = gtfsTrip
  }

  if (!referenceTrip) return null

  let isXPT = referenceTrip.routeGTFSID === '14-XPT'
  let isGSR = referenceTrip.routeGTFSID === '10-GSR'
  let isLive = false

  if (isXPT && referenceTrip.updateTime) isLive = true

  let nspTrip
  if (!isXPT && !isGSR) {
    let vlineTrips = db.getCollection('vline trips')

    let trackerDepartureTime = giveVariance(referenceTrip.departureTime)
    let trackerDestinationArrivalTime = giveVariance(referenceTrip.destinationArrivalTime)

    let origin = referenceTrip.origin.slice(0, -16)
    let destination = referenceTrip.destination.slice(0, -16)

    let possibleOrigins = { $in: [origin] }
    let possibleDestinations = { $in: [destination] }

    if (referenceTrip.type === 'change' && referenceTrip.modifications.length) {
      let originate = referenceTrip.modifications.find(m => m.type === 'originate')
      let terminate = referenceTrip.modifications.find(m => m.type === 'terminate')
      if (originate) possibleOrigins.$in.push(originate.changePoint)
      if (terminate) possibleDestinations.$in.push(terminate.changePoint)
    }

    let tripData
    if (referenceTrip.runID) {
      tripData = await vlineTrips.findDocument({
        date: operationDays,
        runID: referenceTrip.runID
      })
    } else {
      tripData = await vlineTrips.findDocument({
        date: operationDays,
        departureTime: trackerDepartureTime,
        origin: possibleOrigins,
        destination: possibleDestinations
      })
    }

    if (!tripData) {
      if (referenceTrip.direction === 'Up') {
        tripData = await vlineTrips.findDocument({
          date: operationDays,
          departureTime: trackerDepartureTime,
          origin: possibleOrigins
        })
      } else {
        tripData = await vlineTrips.findDocument({
          date: operationDays,
          destination: possibleDestinations,
          destinationArrivalTime: trackerDestinationArrivalTime
        })
      }
    }

    if (tripData) {
      nspTrip = await db.getCollection('timetables').findDocument({
        mode: 'regional train',
        routeGTFSID: referenceTrip.routeGTFSID,
        runID: tripData.runID,
        operationDays: await getDayOfWeek(tripDay),
      })
    } else {
      nspTrip = await findTrip(db.getCollection('timetables'), utils.getDayOfWeek(tripDay), originStop.stopName, destinationStop.stopName, data.departureTime)
      if (nspTrip) {
        tripData = await vlineTrips.findDocument({
          date: operationDays,
          runID: nspTrip.runID
        })
      }
    }

    let {runID, vehicle} = nspTrip || {}

    referenceTrip.runID = runID
    referenceTrip.vehicle = vehicle

    if (tripData) {
      referenceTrip.runID = tripData.runID
      // referenceTrip.consist = tripData.consist
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

      let isSSS = stop.stopName === 'Southern Cross Railway Station'

      if (isSSS && stop.livePlatform) return stop

      if (nspStop) {
        let nspPlatform = nspStop.platform.replace('C', 'A').replace('N', 'B')
        stop.platform = nspPlatform + '?'
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
    isLive,
    originStop
  }
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  let { trip, tripStartTime, isLive, originStop } = tripData

  let firstDepartureTime = trip.stopTimings.find(stop => stop.stopName === originStop.stopName).departureTimeMinutes
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
        early: 1,
        late: 5
      })

      if (isLive && !stop.estimatedDepartureTime) return stop
      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
    }
    return stop
  })
  res.render('runs/vline', {trip})
})

module.exports = router
