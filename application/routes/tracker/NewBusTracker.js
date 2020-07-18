const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')
const busDestinations = require('../../../additional-data/bus-destinations')

const highlightData = require('../../../additional-data/tracker-highlights-new')

const knownBuses = require('../../../additional-data/bus-lists')
const serviceDepots = require('../../../additional-data/service-depots')

let crossDepotQuery = null
let trackUnknown = ['Ventura Bus Lines', 'CDC Ballarat', 'Cranbourne Transit', 'Sunbury Bus Service', 'Martyrs Bus Service', 'Dysons', 'Ryan Bros Bus Service', 'McKenzies Tourist Service']

let manualRoutes = {
  "CO": ["4-601", "4-60S", "4-612", "4-623", "4-624", "4-625", "4-626", "4-630", "4-900"],
  "CS": ["4-406", "4-407", "4-408", "4-409", "4-410", "4-418", "4-419", "4-421", "4-423", "4-424", "4-425", "4-461"],
  "CW": ["4-150", "4-151", "4-153", "4-160", "4-161", "4-166", "4-167", "4-170", "4-180", "4-181", "4-190", "4-191", "4-192", "4-400", "4-411", "4-412", "4-414", "4-415", "4-417", "4-439", "4-441", "4-443", "4-494", "4-495", "4-496", "4-497", "4-498", "4-606"],
}

router.get('/', (req, res) => {
  res.render('tracker/bus/index')
})

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
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

  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
      destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/fleet', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {fleet, date} = querystring.parse(url.parse(req.url).query)

  if (!date) date = today
  if (!fleet) {
    return res.render('tracker/bus/by-fleet', {
      tripsToday: [],
      servicesByDay: {},
      bus: null,
      fleet: '?',
      smartrakID: '?',
      date: moment(date, 'YYYYMMDD')
    })
  }

  let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
  let query = { date }

  let smartrakID

  if (bus) {
    smartrakID = bus.smartrakID
    fleet = `#${fleet}`
  } else {
    smartrakID = parseInt(fleet) || '?'
    bus = await smartrakIDs.findDocument({ smartrakID })
    if (bus) {
      fleet = `#${bus.fleetNumber}`
    }
  }

  query.smartrakID = smartrakID
  let tripsToday = await busTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  tripsToday = tripsToday.map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

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
      date
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



router.get('/service', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {service, date} = querystring.parse(url.parse(req.url).query)

  if (!date) date = today
  if (!service) {
    return res.render('tracker/bus/by-service', {
      tripsToday: [],
      busesByDay: {},
      service: '',
      date: moment(date, 'YYYYMMDD')
    })
  }

  let rawTripsToday = await busTrips.findDocuments({
    date,
    routeNumber: service
  }).sort({departureTime: 1, origin: 1}).toArray()

  let tripsToday = (await async.map(rawTripsToday, async trip => {
    let {fleetNumber} = await smartrakIDs.findDocument({
      smartrakID: trip.smartrakID
    }) || {}

    trip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + trip.smartrakID

    return trip
  })).map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let operationDays = await busTrips.distinct('date', {
    routeNumber: service
  })
  let busesByDay = {}
  let smartrakIDCache = {}

  await async.forEachSeries(operationDays, async date => {
    let smartrakIDsByDate = await busTrips.distinct('smartrakID', {
      date,
      routeNumber: service
    })
    let buses = (await async.map(smartrakIDsByDate, async smartrakID => {
      let fleetNumber = smartrakIDCache[smartrakID]
      if (!fleetNumber) {
        let lookup = await smartrakIDs.findDocument({
          smartrakID
        })
        if (lookup) {
          fleetNumber = lookup.fleetNumber
          smartrakIDCache[smartrakID] = fleetNumber
        }
      }
      return fleetNumber ? '#' + fleetNumber : '@' + smartrakID
    })).sort((a, b) => a.replace(/[^\d]/g, '') - b.replace(/[^\d]/g, ''))

    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)
    busesByDay[humanDate] = {
      buses,
      date
    }
  })

  res.render('tracker/bus/by-service', {
    tripsToday,
    busesByDay,
    service,
    date: moment(date, 'YYYYMMDD')
  })
})

router.get('/highlights', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let routes = db.getCollection('routes')
  let date = utils.getYYYYMMDDNow()

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  async function getBuses(fleets) {
    return await smartrakIDs.distinct('smartrakID', { fleetNumber: { $in: fleets } })
  }

  let highlights = await async.map(highlightData, async section => {
    let trackBuses = section.track,
        routes = section.routes,
        type = section.type,
        buses = section.buses || 'include'

    let matchedBuses = await getBuses(trackBuses)
    let query = {
      date,
      smartrakID: { $in: matchedBuses },
      routeNumber: { $not: { $in: routes} }
    }

    if (type === 'include') {
      query.routeNumber = { $in: routes }
    }
    if (buses === 'exclude') {
      query.smartrakID = { $not: { $in: matchedBuses } }
    }

    let matchedTrips = await busTrips.findDocuments(query)
      .sort({departureTime: 1, origin: 1}).toArray()

    let trips = (await async.map(matchedTrips, async trip => {
      let {fleetNumber} = await smartrakIDs.findDocument({
        smartrakID: trip.smartrakID
      }) || {}

      trip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + trip.smartrakID

      return trip
    })).map(trip => adjustTrip(trip, date, date, minutesPastMidnightNow))

    return {
      ...section,
      trips
    }
  })

  let allBuses = await smartrakIDs.findDocuments().toArray()
  let trackUnknownRoutes = await routes.distinct('routeGTFSID', {
    operators: { $in: trackUnknown }
  })

  trackUnknownRoutes = trackUnknownRoutes.concat(manualRoutes.CO, manualRoutes.CS, manualRoutes.CW)

  let unknownBuses = (await busTrips.findDocuments({
    date,
    routeGTFSID: { $in: trackUnknownRoutes },
    smartrakID: { $not: { $in: allBuses.map(bus => bus.smartrakID) } }
  }).sort({departureTime: 1, origin: 1}).toArray())
    .map(trip => adjustTrip(trip, date, date, minutesPastMidnightNow))

  res.render('tracker/bus/highlights', {
    highlights,
    unknownBuses
  })
})

router.get('/bot', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let date = utils.getYYYYMMDDNow()

  let {fleet, service} = querystring.parse(url.parse(req.url).query)

  if (fleet) {
    let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
    let query = { date }

    let smartrakID

    if (bus) smartrakID = bus.smartrakID
    else smartrakID = parseInt(fleet)

    query.smartrakID = smartrakID
    let tripsToday = await busTrips.findDocuments(query)
      .sort({departureTime: 1}).toArray()

    res.json(tripsToday.map(adjustTrip))
  } else if (service) {
    let rawTripsToday = await busTrips.findDocuments({
      date,
      routeNumber: service
    }).sort({departureTime: 1, origin: 1}).toArray()

    let tripsToday = (await async.map(rawTripsToday, async rawTrip => {
      let {fleetNumber} = await smartrakIDs.findDocument({
        smartrakID: rawTrip.smartrakID
      }) || {}

      let {origin, destination, departureTime} = rawTrip

      rawTrip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + rawTrip.smartrakID
      return rawTrip
    }))

    res.json(tripsToday.map(adjustTrip))
  } else {
    res.json([])
  }
})


module.exports = router
