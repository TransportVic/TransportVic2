const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')

router.get('/', (req, res) => {
  res.render('tracker/index')
})

router.get('/bus', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {fleet} = querystring.parse(url.parse(req.url).query)
  if (!fleet) return res.end()

  let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
  let query = { date }

  let smartrakID

  if (bus) smartrakID = bus.smartrakID
  else smartrakID = parseInt(fleet)

  query.smartrakID = smartrakID
  let tripsToday = await busTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  let operationDays = await busTrips.distinct('date', {
    smartrakID
  })
  let servicesByDay = {}

  await async.forEach(operationDays, async date => {
    servicesByDay[date] = await busTrips.distinct('routeNumber', {
      smartrakID, date
    })
  })

  res.render('tracker/bus', {tripsToday, servicesByDay, bus, fleet, date})
})

router.get('/service', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {service} = querystring.parse(url.parse(req.url).query)
  if (!service) return res.end()

  let rawTripsToday = await busTrips.findDocuments({
    routeNumber: service,
    date
  }).sort({smartrakID: 1, departureTime: 1}).toArray()

  let activeTripsNow = rawTripsToday.filter(trip => {
    let {departureTime, destinationArrivalTime} = trip
    let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
        destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

    return departureTimeMinutes <= minutesPastMidnightNow && minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  let tripsToday = (await async.map(activeTripsNow, async rawTrip => {
    let {fleetNumber} = await smartrakIDs.findDocument({
      smartrakID: rawTrip.smartrakID
    }) || {}

    let {origin, destination, departureTime} = rawTrip

    rawTrip.fleetNumber = fleetNumber
    return rawTrip
  })).filter(t => t.fleetNumber)

  let operationDays = await busTrips.distinct('date', {
    routeNumber: service
  })
  let busesByDay = {}

  await async.forEach(operationDays, async date => {
    let smartrakIDsByDate = await busTrips.distinct('smartrakID', {
      routeNumber: service,
      date
    })
    let buses = (await async.map(smartrakIDsByDate, async smartrakID => {
      let {fleetNumber} = await smartrakIDs.findDocument({
        smartrakID
      }) || {}
      return fleetNumber
    })).filter(Boolean)

    busesByDay[date] = buses
  })

  res.render('tracker/service', {tripsToday, busesByDay, date, service})
})

module.exports = router
