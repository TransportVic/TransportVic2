const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')

async function pickBestTrip(data, db) {
  data.mode = 'regional train'
  let tripDay = moment.tz(data.operationDays, 'YYYYMMDD', 'Australia/Melbourne')

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin + '-railway-station'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination + '-railway-station'
  })
  if (!originStop || !destinationStop) return null

  let query = {
    mode: 'regional train',
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) {
    liveTrip.destination = liveTrip.destination.slice(0, -16)
    liveTrip.origin = liveTrip.origin.slice(0, -16)
    return liveTrip
  }

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument({
    $and: [
      query, {
        operationDays: data.operationDays
      }
    ]
  })
  let vnetTrip = await db.getCollection('timetables').findDocument({
    $and: [
      query, {
        operationDays: utils.getDayName(tripDay)
      }
    ]
  })

  let {runID, vehicle} = vnetTrip || {}

  if (!gtfsTrip) return null

  gtfsTrip.destination = gtfsTrip.destination.slice(0, -16)
  gtfsTrip.origin = gtfsTrip.origin.slice(0, -16)
  gtfsTrip.runID = runID
  gtfsTrip.vehicle = vehicle

  return gtfsTrip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await pickBestTrip(req.params, res.db)
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''

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
  res.render('runs/vline', {trip})
})

module.exports = router
