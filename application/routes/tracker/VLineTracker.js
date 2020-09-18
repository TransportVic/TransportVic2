const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')
const vlineFleet = require('../../../additional-data/vline-fleet')

let lines = {
  Geelong: ['Geelong', 'Marshall', 'South Geelong', 'Waurn Ponds', 'Wyndham Vale', 'Warrnambool'],
  Ballarat: ['Ararat', 'Maryborough', 'Ballarat', 'Wendouree', 'Bacchus Marsh', 'Melton'],
  Bendigo: ['Bendigo', 'Kyneton', 'Epsom', 'Eaglehawk', 'Swan Hill', 'Echuca'],
  Gippsland: ['Traralgon', 'Sale', 'Bairnsdale'],
  Seymour: ['Seymour', 'Shepparton', 'Albury']
}

router.get('/', (req, res) => {
  res.render('tracker/vline/index')
})

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
  let e = utils.encodeName
  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
      destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

  let tripDate = trip.date

  if (departureTimeMinutes < 180) {
    departureTimeMinutes += 1440
    tripDate = utils.getYYYYMMDD(utils.parseDate(tripDate).add(1, 'day'))
  }
  if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

  trip.url = `/vline/run/${e(trip.origin)}-railway-station/${trip.departureTime}/${e(trip.destination)}-railway-station/${trip.destinationArrivalTime}/${tripDate}`

  trip.departureTimeMinutes = departureTimeMinutes
  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/date', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')

  let today = utils.getYYYYMMDDNow()
  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await vlineTrips.findDocuments({ date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/vline/by-date', {
    trips,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/line', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')

  let today = utils.getYYYYMMDDNow()
  let {date, line} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let lineGroup = lines[line] || []

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await vlineTrips.findDocuments({
    date,
    $or: [{
      origin: {
        $in: lineGroup
      }
    }, {
      destination: {
        $in: lineGroup
      }
    }]
  }).sort({destination: 1}).toArray())
  .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
  .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/vline/by-line', {
    trips,
    line,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/consist', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await vlineTrips.findDocuments({ consist, date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/vline/by-consist', {
    trips,
    consist,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/highlights', async (req, res) => {
  let {db} = res
  let vlineTrips = db.getCollection('vline trips')
  let nspTimetables = db.getCollection('timetables')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let dayOfWeek = utils.getDayName(utils.parseDate(date))

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let allTrips = (await vlineTrips.findDocuments({ date })
    .sort({destination: 1}).toArray())
    .filter(trip => trip.consist[0] !== '')
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  let doubleHeaders = allTrips.filter(trip => {
    return trip.consist[1] && trip.consist[0].startsWith('N') && trip.consist[1].startsWith('N')
  })

  let consistTypeChanged = await async.filter(allTrips, async trip => {
    let nspTimetable = await nspTimetables.findDocument({
      runID: trip.runID,
      operationDays: dayOfWeek
    })

    if (nspTimetable) {
      let tripVehicleType
      if (trip.consist[0].startsWith('VL')) tripVehicleType = 'VL'
      else if (trip.consist[0].startsWith('70')) tripVehicleType = 'SP'
      else {
        tripVehicleType = 'N +'
        let carriage = trip.consist.find(c => !c.startsWith('N') && !c.startsWith('P') && (c.includes('N') || c.includes('H')))
        if (carriage) tripVehicleType += carriage.includes('N') ? 'N' : 'H'
        else return true
      }

      let nspTripType = nspTimetable.vehicle
      if (nspTripType.endsWith('+PCJ')) nspTripType = nspTripType.slice(0, -4)

      let vlMatch = (nspTripType.includes('VL') || nspTripType.includes('VR')) && tripVehicleType == 'VL'
      let spMatch = nspTripType.includes('SP') && tripVehicleType == 'SP'

      if (vlMatch || spMatch) return false
      if (nspTripType.startsWith('N') && tripVehicleType.startsWith('N')) {
        return tripVehicleType.slice(-1) !== nspTripType.slice(-1)
      }

      return true
    }
  })

  let unknownVehicle = allTrips.filter(trip => {
    return trip.consist.some(c => !vlineFleet.includes(c))
  })

  res.render('tracker/vline/highlights', {
    doubleHeaders,
    consistTypeChanged,
    unknownVehicle,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

module.exports = router
