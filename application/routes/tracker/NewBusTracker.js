const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')
const busDestinations = require('../../../additional-data/bus-destinations')

const highlightData = require('../../../additional-data/tracker-highlights')

const knownBuses = require('../../../additional-data/bus-lists')
const serviceDepots = require('../../../additional-data/service-depots')

let crossDepotQuery = null

router.get('/', (req, res) => {
  res.render('tracker/bus/index')
})

function adjustTrip(trip) {
  let {origin, destination} = trip
  let serviceData = busDestinations.service[trip.routeNumber] || {}
  let dA = destination, dB = destination.split('/')[0]
  let oA = origin, oB = origin.split('/')[0]

  let e = utils.encodeName
  trip.url = `/bus/run/${e(trip.origin)}/${trip.departureTime}/${e(trip.destination)}/${trip.destinationArrivalTime}/${trip.date}`

  trip.destination = (serviceData[dA] || serviceData[dB]
    || busDestinations.generic[dA] || busDestinations.generic[dB] || dB).replace('Shopping Centre', 'SC')
  trip.origin = (serviceData[oA] || serviceData[oB]
    || busDestinations.generic[oA] || busDestinations.generic[oB] || oB).replace('Shopping Centre', 'SC')

  return trip
}

router.get('/fleet', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {fleet, date} = querystring.parse(url.parse(req.url).query)
  if (!fleet) return res.end()
  if (!date) date = today

  let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
  let query = { date }

  let smartrakID

  if (bus) {
    smartrakID = bus.smartrakID
    fleet = `#${fleet}`
  } else {
    smartrakID = parseInt(fleet)
    bus = await smartrakIDs.findDocument({ smartrakID })
    if (bus) {
      fleet = `#${bus.fleetNumber}`
    } else {
      fleet = '?'
    }
  }

  query.smartrakID = smartrakID
  let tripsToday = await busTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  tripsToday = tripsToday.map(adjustTrip).map(trip => {
    let {departureTime, destinationArrivalTime} = trip
    let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
        destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

    trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today
    return trip
  })

  let operationDays = await busTrips.distinct('date', {
    smartrakID
  })
  let servicesByDay = {}

  await async.forEachSeries(operationDays, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    servicesByDay[humanDate] = {
      services: await busTrips.distinct('routeNumber', {
        smartrakID, date
      }),
      date: date
    }
  })

  res.render('tracker/bus/by-fleet', {
    tripsToday,
    servicesByDay,
    bus,
    fleet,
    smartrakID,
    date: moment(date, 'YYYYMMDD')
  })
})

module.exports = router
