const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/metro-trains/get-stopping-pattern')
const addStonyPointData = require('../../../modules/metro-trains/add-stony-point-data')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central'].map(e => e + ' Railway Station')

let burnleyGroup = [1, 2, 7, 9] // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12] // cranbourne, frankston, pakenham, sandringham
let northernGroup = [3, 14, 15, 16, 17, 1482] // craigieburn, sunbury, upfield, werribee, williamstown, flemington racecourse
let cliftonHillGroup = [5, 8] // mernda, hurstbridge
let crossCityGroup = [6, 16, 17, 1482] // frankston, werribee, williamstown, flemington racecourse
let newportGroup = [16, 17] // werribee, williamstown

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

  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440
  if (tripStartMinutes > 1440) tripDay.add(-1, 'day')
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin + '-railway-station',
    'bays.mode': 'metro train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination + '-railway-station',
    'bays.mode': 'metro train'
  })

  if (!originStop || !destinationStop) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let departureTime = tripStartMinutes
  let destinationArrivalTime = tripEndMinutes

  if (data.destination === 'flinders-street') {
    destinationArrivalTime = {
      $gte: tripEndMinutes - 1,
      $lte: tripEndMinutes + 3
    }
  }

  if (data.origin === 'flinders-street') {
    departureTime = {
      $gte: tripStartMinutes - 1,
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

  let useLive = minutesToTripEnd >= -120 && minutesToTripStart < 240

  let referenceTrip
  if (liveTrip && gtfsTrip) {
    let liveCloseness = tripClosenessBound(liveTrip)
    let gtfsCloseness = tripClosenessBound(gtfsTrip)

    if (liveCloseness <= gtfsCloseness) referenceTrip = liveTrip
    else referenceTrip = gtfsTrip
  } else referenceTrip = liveTrip || gtfsTrip

  let needsRedirect = referenceTrip ? (referenceTrip.trueOrigin !== originStop.stopName
    || referenceTrip.trueDestination !== destinationStop.stopName
    || referenceTrip.trueDepartureTime !== data.departureTime
    || referenceTrip.trueDestinationArrivalTime !== data.destinationArrivalTime) : false

  if (liveTrip && referenceTrip === liveTrip) {
    if (liveTrip.isRailReplacementBus || liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      let isLive = liveTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

      return { trip: liveTrip, tripStartTime, isLive, needsRedirect }
    }
  }

  let isStonyPoint = data.origin === 'stony-point' || data.destination === 'stony-point'

  if (referenceTrip && (isStonyPoint || referenceTrip.routeGTFSID === '2-SPT')) {
    return { trip: await addStonyPointData(referenceTrip, tripStartTime, db), tripStartTime, isLive: false, needsRedirect }
  }

  if (!useLive) return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false, needsRedirect } : null
  if (referenceTrip && referenceTrip.h) {
    let isLive = referenceTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

    return { trip: referenceTrip, tripStartTime, isLive, needsRedirect, needsRedirect }
  }

  let originStopID = originStop.bays.filter(bay => bay.mode === 'metro train')[0].stopGTFSID
  let originTime = tripStartTime.clone()
  let expressCount

  if (referenceTrip) {
    expressCount = 0
    let stops = referenceTrip.stopTimings.map(stop => stop.stopName)
    let flindersIndex = stops.indexOf('Flinders Street Railway Station')

    if (flindersIndex >= 0 && referenceTrip.direction === 'Down') {
      let nonCCLStop = referenceTrip.stopTimings.slice(flindersIndex + 1).find(stop => !cityLoopStations.includes(stop.stopName))

      let flinders = referenceTrip.stopTimings[flindersIndex]
      let stopAfterFlinders = referenceTrip.stopTimings[flindersIndex + 1]
      if (nonCCLStop) stopAfterFlinders = nonCCLStop
      if (stopAfterFlinders.stopName !== destinationStop.stopName) {
        originStopID = stopAfterFlinders.stopGTFSID
        originTime.add(stopAfterFlinders.departureTimeMinutes - flinders.departureTimeMinutes, 'minutes')
      }
    }

    referenceTrip.stopTimings.forEach((stop, i) => {
      if (i === 0) return
      expressCount += stop.stopSequence - referenceTrip.stopTimings[i - 1].stopSequence -1
    })
  }

  // get first stop after flinders, or if only 1 stop (nme shorts) then flinders itself
  // should fix the dumb issue of trips sometimes showing as forming and sometimes as current with crazyburn
  try {
    let isoDeparture = originTime.toISOString()
    let {departures, runs} = await ptvAPI(`/v3/departures/route_type/0/stop/${originStopID}?gtfs=true&date_utc=${originTime.clone().add(-1, 'minutes').toISOString()}&max_results=6&expand=run&expand=stop&include_cancelled=true`)

    let isUp = referenceTrip ? referenceTrip.direction === 'Up' : null
    let possibleDepartures = departures.filter(departure => {
      let run = runs[departure.run_ref]
      let destinationName = run.destination_name.trim()
      let routeID = departure.route_id

      if ((caulfieldGroup.includes(routeID) && destinationName === 'Southern Cross') || destinationName === 'Parliament') {
        destinationName = 'Flinders Street'
      }

      if (northernGroup.includes(routeID) && destinationName === 'Flagstaff') {
        destinationName = 'Flinders Street'
      }

      if (isUp && northernGroup.includes(routeID) && destinationName === 'Southern Cross') { // This kind of merging only happens with train runs, never bus runs
        let secondDigit = departure.run_ref[1]
        if (secondDigit > 5) destinationName = 'Flinders Street'
      }

      let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc).toISOString()

      let timeMatch = scheduledDepartureTime === isoDeparture
      if (timeMatch) {
        if (isUp && departure.direction_id === 1) {
          return true
        } else {
          if (referenceTrip) {
            let fullDestinationName = destinationName + ' Railway Station'

            return fullDestinationName === referenceTrip.destination
              || fullDestinationName === referenceTrip.trueDestination
              || fullDestinationName === referenceTrip.originalDestination
              || utils.encodeName(destinationName) === data.destination
          } else {
            return utils.encodeName(destinationName) === data.destination
          }
        }
      }
      return false
    })

    let departureToUse

    if (possibleDepartures.length > 1) {
      departureToUse = possibleDepartures.find(possibleDeparture => {
        return runs[possibleDeparture.run_ref].express_stop_count === expressCount
      })
    } else departureToUse = possibleDepartures[0]

    // interrim workaround cos when services start from a later stop they're really cancelled
    // in the stops before, but PTV thinks otherwise...
    if (!departureToUse) {
      let needsRedirect = referenceTrip ? (referenceTrip.trueOrigin !== originStop.stopName
        || referenceTrip.trueDestination !== destinationStop.stopName
        || referenceTrip.trueDepartureTime !== data.departureTime
        || referenceTrip.trueDestinationArrivalTime !== data.destinationArrivalTime) : false

      return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false, needsRedirect } : null
    }
    let ptvRunID = departureToUse.run_ref
    let departureTime = departureToUse.scheduled_departure_utc

    let isRailReplacementBus = departureToUse.flags.includes('RRB-RUN')

    let trip = await getStoppingPattern({
      ptvRunID,
      time: departureTime,
      referenceTrip
    }, db)

    let isLive = trip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

    let needsRedirect = trip.trueOrigin !== originStop.stopName
      || trip.trueDestination !== destinationStop.stopName
      || trip.trueDepartureTime !== data.departureTime
      || trip.trueDestinationArrivalTime !== data.destinationArrivalTime

    let actualOriginStop = trip.stopTimings.find(stop => stop.stopName === trip.trueOrigin)

    return {
      trip,
      tripStartTime: utils.parseTime(actualOriginStop.scheduledDepartureTime),
      isLive,
      needsRedirect
    }
  } catch (e) {
    global.loggers.general.err('Failed to get Metro trip', e)
    return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false } : null
  }
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
    return res.redirect(`/metro/run/${utils.encodeName(trip.trueOrigin.slice(0, -16))}/${trip.trueDepartureTime}/${utils.encodeName(trip.trueDestination.slice(0, -16))}/${trip.trueDestinationArrivalTime}/${operationDay}`)
  }

  let trueOrigin = trip.stopTimings.find(stop => stop.stopName === trip.trueOrigin)
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
