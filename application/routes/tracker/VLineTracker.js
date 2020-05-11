const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')

router.get('/', (req, res) => {
  res.render('tracker/vline/index')
})

router.get('/today', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let tripsToday = await vlineTrips.findDocuments({ date })
    .sort({departureTime: 1, destination: 1}).toArray()

  let activeTripsNow = tripsToday.filter(trip => {
    let {departureTime, destinationArrivalTime} = trip

    let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
        destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

    return minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  res.render('tracker/vline/today', {activeTripsNow, date})
})

router.get('/by-date', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')

  let {date} = querystring.parse(url.parse(req.url).query)

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = await vlineTrips.findDocuments({ date })
    .sort({departureTime: 1, destination: 1}).toArray()

  res.render('tracker/vline/by-date', {trips, date})
})

router.get('/by-consist', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)

  date = date || today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = await vlineTrips.findDocuments({ consist, date })
    .sort({departureTime: 1, destination: 1}).toArray()

  res.render('tracker/vline/by-consist', {trips, date})
})

module.exports = router
