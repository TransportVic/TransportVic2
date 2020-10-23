const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
const addStonyPointData = require('../../../modules/metro-trains/add-stony-point-data')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central'].map(e => e + ' Railway Station')

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

  let destinationArrivalTime = tripEndMinutes
  let departureTime = tripStartMinutes
  let liveDestinationArrivalTime = tripEndMinutes % 1440
  let liveDepartureTime = tripStartMinutes % 1440

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

  let liveTrip = await db.getCollection('live timetables').findDocument(liveQuery)
  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(gtfsQuery)

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
  let expressCount = undefined

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

    if (possibleDepartures.length > 1) {
      departure = possibleDepartures.filter(departure => {
        return runs[departure.run_ref].express_stop_count === expressCount
      })[0]
    } else departure = possibleDepartures[0]

    // interrim workaround cos when services start from a later stop they're really cancelled
    // in the stops before, but PTV thinks otherwise...
    if (!departure) return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false } : null
    let ptvRunID = departure.run_ref
    let departureTime = departure.scheduled_departure_utc

    let isRailReplacementBus = departure.flags.includes('RRB-RUN')

    let trip = await getStoppingPattern(db, ptvRunID, 'metro train', departureTime, null, referenceTrip, {
      isRailReplacementBus,
      trimStops: true
    })

    let isLive = trip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

    return { trip, tripStartTime, isLive }
  } catch (e) {
    console.error(e)
    return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive: false } : null
  }
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  let { trip, tripStartTime, isLive } = tripData

  let trueOrigin = trip.stopTimings.find(stop => stop.stopName === trip.trueOrigin)
  let firstDepartureTime = trueOrigin.departureTimeMinutes

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
