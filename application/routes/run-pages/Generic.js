const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
const busStopNameModifier = require('../../../load-gtfs/metro-bus/bus-stop-name-modifier')
const tramFleet = require('../../../tram-fleet')

async function pickBestTrip(data, db) {
  let tripDay = moment.tz(data.operationDays, 'YYYYMMDD', 'Australia/Melbourne')
  let tripStartTime = moment.tz(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = moment.tz(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)

  let originStop = await db.getCollection('stops').findDocument({
    codedNames: data.origin,
    'bays.mode': data.mode
  })

  let destinationStop = await db.getCollection('stops').findDocument({
    codedNames: data.destination,
    'bays.mode': data.mode
  })
  if (!originStop || !destinationStop) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let originName = originStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.origin)[0].fullStopName
  let destinationName = destinationStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.destination)[0].fullStopName

  let query = {
    mode: data.mode,
    origin: originName,
    departureTime: data.departureTime,
    destination: destinationName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays: data.operationDays
  }

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)
  let liveTrip = await db.getCollection('live timetables').findDocument(query)

  let useLive = minutesToTripEnd > -5 && minutesToTripStart < 120

  if (liveTrip) {
    if (liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      return liveTrip
    }
  }

  if (!useLive) return gtfsTrip

  // So PTV API only returns estimated timings for bus if stop_id is set and the bus hasn't reached yet...
  let referenceTrip = liveTrip || gtfsTrip
  let startsBeforeMidnight = tripStartMinutes < 1440

  let checkStop = referenceTrip.stopTimings.map(stopTiming => {
    if (startsBeforeMidnight && stopTiming.departureTimeMinutes < 60 * 8)
      stopTiming.departureTimeMinutes += 1440
    stopTiming.actualDepartureTime = utils.now().startOf('day').add(stopTiming.departureTimeMinutes, 'minutes')
    return stopTiming
  }).filter(stopTiming => {
    return stopTiming.actualDepartureTime.diff(utils.now(), 'minutes') > 0
  }).slice(1)[0]

  if (!checkStop) return gtfsTrip

  let checkStopTime = moment.tz(`${data.operationDays} ${checkStop.departureTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let isoDeparture = checkStopTime.toISOString()
  let mode = data.mode === 'bus' ? 2 : 1
  try {
    let {departures, runs} = await ptvAPI(`/v3/departures/route_type/${mode}/stop/${checkStop.stopGTFSID}?gtfs=true&date_utc=${tripStartTime.clone().add(-3, 'minutes').toISOString()}&max_results=5&expand=run&expand=stop`)

    let departure = departures.filter(departure => {
      let run = runs[departure.run_id]
      let destinationName = busStopNameModifier(utils.adjustStopname(run.destination_name.trim()))
        .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')
      let scheduledDepartureTime = moment(departure.scheduled_departure_utc).toISOString()

      return scheduledDepartureTime === isoDeparture &&
        destinationName === referenceTrip.destination
    })[0]

    if (!departure) return gtfsTrip
    let ptvRunID = departure.run_id
    let departureTime = departure.scheduled_departure_utc

    let trip = await getStoppingPattern(db, ptvRunID, data.mode, departureTime, departure.stop_id, gtfsTrip)
    return trip
  } catch (e) {
    return gtfsTrip
  }
}

router.get('/:mode/run/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res, next) => {
  if (!['bus', 'tram'].includes(req.params.mode)) return next()

  let trip = await pickBestTrip(req.params, res.db)
  if (!trip) return res.end('Could not find trip :(')
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''

    stop.headwayDevianceClass = 'unknown'
    if (stop.estimatedDepartureTime) {
      let scheduledDepartureTime =
        moment.tz(`${req.params.operationDays} ${stop.departureTime || stop.arrivalTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
      let headwayDeviance = scheduledDepartureTime.diff(stop.estimatedDepartureTime, 'minutes')

      if (headwayDeviance > 2) {
        stop.headwayDevianceClass = 'early'
      } else if (headwayDeviance <= -5) {
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

  if (trip.vehicle) {
    if (req.params.mode === 'tram') {
      let tramModel = tramFleet.getModel(trip.vehicle)
      trip.vehicleData = {
        name: `Tram ${tramModel}.${trip.vehicle}`
      }
    } else if (req.params.mode === 'bus') {
      let smartrakIDs = res.db.getCollection('smartrak ids')

      let busRego = (await smartrakIDs.findDocument({
        smartrakID: parseInt(trip.vehicle)
      }) || {}).fleetNumber
      if (busRego) {
        trip.vehicleData = {
          name: 'Bus #' + busRego
        }
      }
    }
  }
  res.render('runs/generic', {trip, shorternStopName: utils.shorternStopName})
})

module.exports = router
