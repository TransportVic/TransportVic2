const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')

async function pickBestTrip(data, db) {
  data.mode = 'regional coach'

  let tripDay = moment.tz(data.operationDays, 'YYYYMMDD', 'Australia/Melbourne')

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin,
    'bays.mode': 'regional coach'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination,
    'bays.mode': 'regional coach'
  })
  if (!originStop || !destinationStop) return null

  let query = {
    mode: 'regional coach',
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays: data.operationDays
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) return liveTrip

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)

  return gtfsTrip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await pickBestTrip(req.params, res.db)
  if (!trip) return res.status(404).render('errors/no-trip')

  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''
    stop.headwayDevianceClass = 'unknown'
    
    let scheduledDepartureTime =
      moment.tz(`${req.params.operationDays} ${stop.departureTime || stop.arrivalTime}`, 'YYYYMMDD HH:mm', 'Australia/Melbourne')

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

  res.render('runs/generic', {trip, shorternStopName: utils.shorternStopName})
})

module.exports = router
