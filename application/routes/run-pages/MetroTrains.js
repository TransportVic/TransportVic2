const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
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

  return originDiff + destDiff
}

async function pickBestTrip(data, db) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required
  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440

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

  let liveDepartureTime = tripStartMinutes % 1440
  let liveDestinationArrivalTime = tripEndMinutes % 1440
  if (liveDestinationArrivalTime < liveDepartureTime) liveDestinationArrivalTime += 1440

  if (data.destination === 'flinders-street') {
    destinationArrivalTime = {
      $gte: tripEndMinutes - 1,
      $lte: tripEndMinutes + 3
    }
    liveDestinationArrivalTime = {
      $gte: tripEndMinutes - 1 % 1440,
      $lte: tripEndMinutes + 3 % 1440
    }
  }

  if (data.origin === 'flinders-street') {
    departureTime = {
      $gte: tripStartMinutes - 1,
      $lte: tripStartMinutes + 3
    }
    liveDepartureTime = {
      $gte: tripStartMinutes - 1 % 1440,
      $lte: tripStartMinutes + 3 % 1440
    }
  }

  let operationDays = data.operationDays
  if (tripStartMinutes > 1440) operationDays = utils.getYYYYMMDD(tripDay.clone().add(-1, 'day'))

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

  let liveQuery = {
    $and: [{
      mode: 'metro train',
      operationDays: data.operationDays // because this uses true departure day
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: originStop.stopName,
          departureTimeMinutes: liveDepartureTime
        }
      }
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: destinationStop.stopName,
          arrivalTimeMinutes: liveDestinationArrivalTime
        }
      }
    }]
  }

  // NME, RMD shorts are always loaded live
  let liveTrips = await db.getCollection('live timetables').findDocuments(liveQuery).toArray()
  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(gtfsQuery)

  let liveTrip

  if (liveTrips.length > 1) {
    let tripClosenessBound = trip => tripCloseness(trip, originStop, destinationStop, tripStartMinutes, tripEndMinutes)
    liveTrip = liveTrips.sort((a, b) => tripClosenessBound(a) - tripClosenessBound(b))[0]
  } else liveTrip = liveTrips[0]

  let useLive = minutesToTripEnd >= -120 && minutesToTripStart < 240

  if (liveTrip) {
    if (liveTrip.isRailReplacementBus || liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      let isLive = liveTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

      return { trip: liveTrip, tripStartTime, isLive }
    }
  }

  let referenceTrip = liveTrip || gtfsTrip

  let isStonyPoint = data.origin === 'stony-point' || data.destination === 'stony-point'

  if (referenceTrip && (isStonyPoint || referenceTrip.routeGTFSID === '2-SPT')) {
    return { trip: await addStonyPointData(db, referenceTrip, tripStartTime), tripStartTime, isLive: false }
  }

  if (!useLive) return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false } : null

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
    let {departures, runs} = await ptvAPI(`/v3/departures/route_type/0/stop/${originStopID}?gtfs=true&date_utc=${originTime.clone().add(-3, 'minutes').toISOString()}&max_results=3&expand=run&expand=stop&include_cancelled=true`)

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
    if (!departureToUse) return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false } : null
    let ptvRunID = departureToUse.run_ref
    let departureTime = departureToUse.scheduled_departure_utc

    let isRailReplacementBus = departureToUse.flags.includes('RRB-RUN')

    let trip = await getStoppingPattern(db, ptvRunID, 'metro train', departureTime, null, referenceTrip, {
      isRailReplacementBus,
      trimStops: referenceTrip ? referenceTrip.affectedBySuspension : false
    })

    let isLive = trip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

    return { trip, tripStartTime, isLive }
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

  let { trip, tripStartTime, isLive } = tripData

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

    if (trip.cancelled) {
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
