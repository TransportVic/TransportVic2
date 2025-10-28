const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')
const busDestinations = require('../../../additional-data/bus-destinations')
const router = new express.Router()

const highlightData = require('../../../additional-data/bus-tracker/highlights')

const knownBuses = require('../../../additional-data/bus-tracker/fleetlist')
const serviceDepots = require('../../../additional-data/bus-tracker/depots')
const operatorCodes = require('../../../additional-data/bus-tracker/operators')

let crossDepotQuery = null

let manualRoutes = {
  "CO": ["4-601", "4-60S", "4-612", "4-623", "4-624", "4-625", "4-626", "4-630", "4-900"],
  "CS": ["4-406", "4-407", "4-408", "4-409", "4-410", "4-418", "4-419", "4-421", "4-423", "4-424", "4-425", "4-461"],
  "CW": ["4-150", "4-151", "4-153", "4-160", "4-161", "4-166", "4-167", "4-170", "4-180", "4-181", "4-190", "4-191", "4-192", "4-400", "4-411", "4-412", "4-414", "4-415", "4-417", "4-439", "4-441", "4-443", "4-494", "4-495", "4-496", "4-497", "4-498", "4-606"],
}

const rateLimit = require('express-rate-limit')

router.use(rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15
}))

async function generateCrossDepotQuery(smartrakIDs) {
  if (crossDepotQuery) return

  crossDepotQuery = { $or: [] }
  await async.forEach(Object.keys(knownBuses), async fleet => {
    let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
    let busDepot = knownBuses[fleet]
    let depotRoutes = serviceDepots[busDepot]

    if (bus && depotRoutes) {
      crossDepotQuery.$or.push({
        smartrakID: bus.smartrakID,
        routeNumber: { $not: { $in: depotRoutes } }
      })
    }
  })
}

async function findCrossDepotTrips(busTrips, smartrakIDs, date) {
  await generateCrossDepotQuery(smartrakIDs)

  let crossDepotQueryOnDate = {
    $or: crossDepotQuery.$or.map(e => {
      return {
        ...e,
        date
      }
    })
  }

  let crossDepotTrips = await busTrips.findDocuments(crossDepotQueryOnDate)
    .sort({departureTime: 1}).toArray()

  return crossDepotTrips
}

async function getBusFromRego(busRegos, rego) {
  return await utils.getData('smartrak-id', rego, async () => {
    return await busRegos.findDocument({ rego })
  }, 1000 * 5)
}

router.get('/', (req, res) => {
  res.render('tracker/bus/index')
})

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
  let e = utils.encodeName
  trip.url = `/bus/run/${e(trip.origin)}/${trip.departureTime}/${e(trip.destination)}/${trip.destinationArrivalTime}/${trip.date}`

  let origin = utils.getDestinationName(trip.origin)
  let destination = utils.getDestinationName(trip.destination)

  let serviceData = busDestinations.service[trip.routeGTFSID] || busDestinations.service[trip.routeNumber] || {}

  trip.destination = (serviceData[destination]
    || busDestinations.generic[destination] || destination)
  trip.origin = (serviceData[origin]
    || busDestinations.generic[origin] || origin)

  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)
  let destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)
  if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/fleet', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let busRegos = tripDB.getCollection('bus regos')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {fleet, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!fleet) {
    return res.render('tracker/bus/by-fleet', {
      tripsToday: [],
      servicesByDay: {},
      bus: null,
      fleet: '?',
      smartrakID: '?',
      date: utils.parseTime(date, 'YYYYMMDD')
    })
  }

  let bus = await busRegos.findDocument({ fleetNumber: fleet })
  let query = { date }

  let rego

  if (bus) {
    rego = bus.rego
    fleet = `#${fleet}`
  } else {
    rego = fleet
    bus = await getBusFromRego(busRegos, rego)
    if (bus) {
      fleet = `#${bus.fleetNumber}`
    }
  }

  query.consist = rego
  let tripsToday = await busTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  tripsToday = tripsToday.map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let allDates = (await busTrips.distinct('date', { consist: rego })).reverse().slice(0, 60)

  let servicesByDay = await async.map(allDates, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    let services = await busTrips.distinct('routeNumber', { consist: rego, date })

    return {
      date,
      humanDate,
      services: services.sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
    }
  })

  res.render('tracker/bus/by-fleet', {
    tripsToday,
    servicesByDay,
    bus,
    fleet,
    rego: rego,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/service', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let busRegos = tripDB.getCollection('bus regos')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {service, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!service) {
    return res.render('tracker/bus/by-service', {
      tripsToday: [],
      busesByDay: {},
      service: '',
      date: utils.parseTime(date, 'YYYYMMDD')
    })
  }

  let routeQuery = {
    $in: [
      service,
      service + 'A',
      service + 'B',
      service + 'C',
      service + 'D',
      service + 'F'
    ]
  }

  let rawTripsToday = await busTrips.findDocuments({
    date,
    routeNumber: routeQuery
  }).sort({departureTime: 1, origin: 1}).toArray()

  const d = async r => {
    let {fleetNumber} = await getBusFromRego(busRegos, r) || {}

    return fleetNumber ? '#' + fleetNumber : r
  }

  let tripsToday = (await async.map(rawTripsToday, async trip => {
    trip.fleetNumber = await d(trip.consist[0])

    return trip
  })).map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let allDates = (await busTrips.distinct('date', { routeNumber: routeQuery })).reverse().slice(0, 60)

  let busesByDay = await async.map(allDates, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    let buses = await busTrips.distinct('consist', { routeNumber: routeQuery, date })

    return {
      date,
      humanDate,
      buses: (await async.map(buses, d)).sort((a, b) => a.replace(/[^\d]/g, '') - b.replace(/[^\d]/g, ''))
    }
  })

  res.render('tracker/bus/by-service', {
    tripsToday,
    busesByDay,
    service,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/operator-list', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let smartrakIDs = tripDB.getCollection('smartrak ids')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {operator, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!operator) {
    return res.render('tracker/bus/by-operator', {
      buses: {},
      allBuses: [],
      operator: '',
      date: utils.parseTime(date, 'YYYYMMDD'),
      rawDate: date
    })
  }

  let allBuses = (await smartrakIDs.findDocuments({
    operator
  }).sort({ fleetNumber: 1 }).toArray())
  .sort((a, b) => a.fleetNumber.replace(/[^\d]/g, '') - b.fleetNumber.replace(/[^\d]/g, ''))

  let allGTFSIDs = allBuses.map(bus => bus.smartrakID)

  let rawTripsToday = await busTrips.findDocuments({
    date,
    smartrakID: { $in: allGTFSIDs }
  }).sort({ routeNumber: 1 }).toArray()

  let buses = {}
  rawTripsToday.forEach(trip => {
    let {fleetNumber} = allBuses.find(bus => bus.smartrakID === trip.smartrakID)
    if (!buses[fleetNumber]) buses[fleetNumber] = []
    if (!buses[fleetNumber].includes(trip.routeNumber)) {
      buses[fleetNumber].push(trip.routeNumber)
    }
  })

  return res.render('tracker/bus/by-operator', {
    buses,
    allBuses,
    operator,
    date: utils.parseTime(date, 'YYYYMMDD'),
    rawDate: date
  })
})

router.get('/highlights', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let busRegos = tripDB.getCollection('bus regos')

  let today = utils.getYYYYMMDDNow()

  let {operator, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  async function getBuses(fleets) {
    return await busRegos.distinct('rego', { fleetNumber: { $in: fleets } })
  }

  let highlights = await async.map(highlightData, async section => {
    let trackBuses = section.track,
        routes = section.routes,
        type = section.type,
        buses = section.buses || 'include'

    let matchedBuses = await getBuses(trackBuses)
    let query = {
      date,
      consist: { $in: matchedBuses },
      routeNumber: { $not: { $in: routes} }
    }

    if (type === 'include') {
      query.routeNumber = { $in: routes }
    }
    if (buses === 'exclude') {
      query.consist = { $not: { $in: matchedBuses } }
    }

    let matchedTrips = await busTrips.findDocuments(query)
      .sort({departureTime: 1, origin: 1}).toArray()

    let trips = (await async.map(matchedTrips, async trip => {
      let {fleetNumber} = await getBusFromRego(busRegos, trip.consist[0]) || {}

      trip.fleetNumber = fleetNumber ? '#' + fleetNumber : trip.consist[0]

      return trip
    })).map(trip => adjustTrip(trip, date, date, minutesPastMidnightNow))

    return {
      ...section,
      trips
    }
  })

  let allBuses = await busRegos.distinct('rego')

  let unknownBuses = (await busTrips.findDocuments({
    date,
    consist: { $not: { $in: allBuses } }
  }).sort({departureTime: 1, origin: 1}).toArray())
    .map(trip => adjustTrip(trip, date, date, minutesPastMidnightNow))

  res.render('tracker/bus/highlights', {
    highlights,
    unknownBuses
  })
})

router.get('/cross-depot', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let smartrakIDs = tripDB.getCollection('smartrak ids')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let crossDepotTrips = await findCrossDepotTrips(busTrips, smartrakIDs, date)

  let tripsToday = (await async.map(crossDepotTrips, async trip => {
    let {fleetNumber} = await getBusFromRego(smartrakIDs, trip.smartrakID) || {}

    trip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + trip.smartrakID

    return trip
  })).map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let operators = {}
  tripsToday.forEach(trip => {
    let operator = trip.fleetNumber[1]
    if (!operators[operator]) operators[operator] = []
    operators[operator].push(trip)
  })

  res.render('tracker/bus/cross-depot', {
    operators,
    operatorCodes,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/bot', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let smartrakIDs = tripDB.getCollection('smartrak ids')
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
      let {fleetNumber} = await getBusFromRego(smartrakIDs, smartrakID) || {}

      let {origin, destination, departureTime} = rawTrip

      rawTrip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + rawTrip.smartrakID
      return rawTrip
    }))

    res.json(tripsToday.map(adjustTrip))
  } else {
    res.json([])
  }
})

router.get('/operator-unknown', async (req, res) => {
  let { db, tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let smartrakIDs = tripDB.getCollection('smartrak ids')
  let routes = db.getCollection('routes')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {operator, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!operator) {
    return res.render('tracker/bus/by-operator-unknown', {
      tripsToday: [],
      busesByDay: {},
      buses: {},
      operator: '',
      date: utils.parseTime(date, 'YYYYMMDD')
    })
  }

  let operatorName = operatorCodes[operator]
  let allBuses = await smartrakIDs.distinct('smartrakID')

  let operatorServices = manualRoutes[operator] || await routes.distinct('routeGTFSID', {
    operators: operatorName
  })

  let tripsToday = (await busTrips.findDocuments({
    date,
    routeGTFSID: {
      $in: operatorServices
    },
    smartrakID: {
      $not: {
        $in: allBuses
      }
    }
  }).sort({departureTime: 1, origin: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  // With such a complex query it is probably more efficient to cache the result from the aggregation pipeline
  let rawBusesByDay = await busTrips.aggregate([{
    $match: {
      routeGTFSID: {
        $in: operatorServices
      },
      smartrakID: {
        $not: {
          $in: allBuses
        }
      }
    }
  }, {
    $group: {
      _id: '$date',
      smartraks: {
        $addToSet: '$smartrakID'
      }
    }
  }, {
    $sort: {
      _id: -1
    }
  }]).toArray()

  let busesByDay = rawBusesByDay.map(data => {
    let date = data._id
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    let buses = data.smartraks.map(smartrak => {
      return '@' + smartrak
    }).sort((a, b) => a.slice(1) - b.slice(1))

    return {
      date,
      humanDate,
      buses
    }
  })

  return res.render('tracker/bus/by-operator-unknown', {
    tripsToday,
    busesByDay,
    operator: operatorName,
    operatorCode: operator,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.use('/locator', require('./BusLocator'))

module.exports = router
module.exports.initDB = async db => {
  let smartrakIDs = db.getCollection('smartrak ids')
  await generateCrossDepotQuery(smartrakIDs)
}
