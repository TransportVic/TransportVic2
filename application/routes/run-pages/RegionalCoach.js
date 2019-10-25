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
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) return liveTrip

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument({
    $and: [
      query, {
        operationDays: data.operationDays
      }
    ]
  })

  return gtfsTrip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await pickBestTrip(req.params, res.db)
  if (!trip) return res.end('Could not find trip :(')

  res.render('runs/generic', {trip})
})

module.exports = router
