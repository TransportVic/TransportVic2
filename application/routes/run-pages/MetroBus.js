const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
const busStopNameModifier = require('../../../load-gtfs/metro-bus/bus-stop-name-modifier')

async function pickBestTrip(data, db) {
  data.mode = 'metro bus'
  let tripDay = moment.tz(data.operationDays, 'YYYYMMDD', 'Australia/Melbourne')
  let tripStartTime = moment.tz(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = moment.tz(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  let operationHour = Math.floor(tripStartMinutes / 60)

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin
  })

  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination
  })
  if (!originStop || !destinationStop) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let originName = originStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.origin)[0].fullStopName
  let destinationName = destinationStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.destination)[0].fullStopName

  let query = {
    mode: 'metro bus',
    origin: originName,
    departureTime: data.departureTime,
    destination: destinationName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) {
    if (!(liveTrip.type === 'timings' && new Date() - liveTrip.updateTime > 2 * 60 * 1000)) {
      return liveTrip
    }
  }

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument({
    mode: 'metro bus',
    origin: originName,
    departureTime: data.departureTime,
    destination: destinationName,
    destinationArrivalTime: data.destinationArrivalTime,
    tripStartHour: { $lte: operationHour },
    tripEndHour: { $gte: operationHour }
  })

  return gtfsTrip

  // So PTV API only returns estimated timings for bus if stop_id is set and the bus hasn't reached yet...
  // let referenceTrip = liveTrip || gtfsTrip
  // originStop = referenceTrip.stopTimings[0]
  //
  // let isoDeparture = tripStartTime.toISOString()
  // let {departures, runs} = await ptvAPI(`/v3/departures/route_type/2/stop/${originStop.stopGTFSID}?gtfs=true&date_utc=${tripStartTime.clone().add(-3, 'minutes').toISOString()}&max_results=2&expand=run&expand=stop`)
  //
  // let departure = departures.filter(departure => {
  //   let run = runs[departure.run_id]
  //   let destinationName = busStopNameModifier(utils.adjustStopname(run.destination_name.trim()))
  //   let scheduledDepartureTime = moment(departure.scheduled_departure_utc).toISOString()
  //
  //   return scheduledDepartureTime === isoDeparture &&
  //     destinationName === referenceTrip.destination
  // })[0]
  //
  // if (!departure) return gtfsTrip
  // let ptvRunID = departure.run_id
  // let departureTime = departure.scheduled_departure_utc
  //
  // let trip = await getStoppingPattern(db, ptvRunID, 'metro bus', departureTime)
  // return trip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
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
        departure.headwayDevianceClass = 'early'
      } else if (headwayDeviance <= -5) {
        departure.headwayDevianceClass = 'late'
      } else {
        departure.headwayDevianceClass = 'on-time'
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
  res.render('runs/generic', {trip})
})

module.exports = router
