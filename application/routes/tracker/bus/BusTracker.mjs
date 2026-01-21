import async from 'async'
import express, { raw } from 'express'
import utils from '../../../../utils.mjs'
import url from 'url'
import querystring from 'querystring'
import busDestinations from '../../../../additional-data/bus-destinations.json' with { type: 'json' }

import highlightData from '../../../../additional-data/bus-tracker/highlights.js'
import smartrakDepots from '../../../../transportvic-data/excel/bus/depots/bus-depots.json' with { type: 'json' }

import rawDepotAllocations from '../../../../additional-data/bus-tracker/depot-allocations.json' with { type: 'json' }
import manualOverrides from '../../../../additional-data/bus-tracker/manual-overrides.json' with { type: 'json' }

import operatorCodes from '../../../../additional-data/bus-tracker/operators.json' with { type: 'json' }
import BusTracker from '../../../model/tracker/BusTracker.mjs'

const depotAllocations = {
  ...rawDepotAllocations, ...manualOverrides
}

const router = new express.Router()

const smartrakDepotLookup = Object.keys(smartrakDepots).reduce((acc, depotID) => ({
  ...acc,
  [smartrakDepots[depotID]]: depotID
}), {})

let crossDepotQuery = null

let manualRoutes = {
  "CO": ["4-601", "4-60S", "4-612", "4-623", "4-624", "4-625", "4-626", "4-630", "4-900"],
  "CS": ["4-406", "4-407", "4-408", "4-409", "4-410", "4-418", "4-419", "4-421", "4-423", "4-424", "4-425", "4-461"],
  "CW": ["4-150", "4-151", "4-153", "4-160", "4-161", "4-166", "4-167", "4-170", "4-180", "4-181", "4-190", "4-191", "4-192", "4-400", "4-411", "4-412", "4-414", "4-415", "4-417", "4-439", "4-441", "4-443", "4-494", "4-495", "4-496", "4-497", "4-498", "4-606"],
}

async function generateCrossDepotQuery(busRegos) {
  if (crossDepotQuery) return

  const allBuses = (await busRegos.findDocuments({
    fleetNumber: { $in: Object.keys(depotAllocations) }
  }, { rego: 1, fleetNumber: 1 }).toArray()).reduce((acc, bus) => ({
    ...acc, [bus.fleetNumber]: bus.rego
  }), {})

  crossDepotQuery = {
    $or: Object.keys(depotAllocations).filter(fleetNumber => depotAllocations[fleetNumber] !== 'Kinetic (Orbital)').map(fleetNumber => ({
      consist: allBuses[fleetNumber],
      depot: { $ne: smartrakDepotLookup[depotAllocations[fleetNumber]] }
    }))
  }

  return crossDepotQuery
}

async function findCrossDepotTrips(busTrips, regos, date) {
  await generateCrossDepotQuery(regos)

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
  const searchParams = req.urlData.searchParams
  const fleetNum = searchParams.get('fleet')
  const date = searchParams.get('date')

  const tracker = new BusTracker(res.tripDB)
  const trips = await tracker.getTripsByFleet(fleetNum, { date })
  const regoData = await tracker.getBusData(fleetNum)

  const servicesByDay = await tracker.getHistory(
    await tracker.getFleetQuery(fleetNum),
    'routeNumber'
  )

  return res.render('tracker/bus/by-fleet', {
    tripsToday: trips,
    servicesByDay,
    regoData,
    query: fleetNum,
    date: date ? utils.parseDate(date) : utils.now()
  })
})

router.get('/service', async (req, res) => {
  const searchParams = req.urlData.searchParams
  const routeNumber = searchParams.get('service')
  const date = searchParams.get('date')

  const tracker = new BusTracker(res.tripDB)
  const trips = await tracker.getTripsByRoute(routeNumber, { date })

  const busesByDay = await tracker.setRegosOnHistory(await tracker.getHistory(
    await tracker.getRouteQuery(routeNumber),
    'consist'
  ))

  return res.render('tracker/bus/by-service', {
    tripsToday: trips,
    busesByDay,
    service: routeNumber,
    date: date ? utils.parseDate(date) : utils.now()
  })
})

router.get('/operator-list', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let regos = tripDB.getCollection('bus regos')

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

  let allBuses = (await regos.findDocuments({
    operator
  }).sort({ fleetNumber: 1 }).toArray())
  .sort((a, b) => a.fleetNumber.replace(/[^\d]/g, '') - b.fleetNumber.replace(/[^\d]/g, ''))

  let allRegos = allBuses.map(bus => bus.rego)

  let rawTripsToday = await busTrips.findDocuments({
    date,
    consist: { $in: allRegos }
  }).sort({ routeNumber: 1 }).toArray()

  let buses = {}
  rawTripsToday.forEach(trip => {
    let {fleetNumber} = allBuses.find(bus => bus.rego === trip.consist[0])
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

  const unsureBusRegos = await busRegos.findDocuments({ fleetNumber: /\?$/ }).toArray()
  const unsureBuses = (await busTrips.findDocuments({
    date,
    consist: { $in: unsureBusRegos.map(bus => bus.rego) }
  }).sort({departureTime: 1, origin: 1}).toArray())
    .map(trip => adjustTrip(trip, date, date, minutesPastMidnightNow))
    .map(trip => {
      const busData = unsureBusRegos.find(bus => bus.rego === trip.consist[0])
      trip.fleetNumber = '#' + busData.fleetNumber
      return trip
    })

  res.render('tracker/bus/highlights', {
    highlights,
    unknownBuses,
    unsureBuses
  })
})

router.get('/endeavours', async (req, res) => {
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

  let data = [{
    name: 'Ventura Endeavours',
    track: Array(1653 - 1632 + 1).fill(0).map((_, i) => `V${1632 + i}`)
  }, {
    name: 'Sunbury Endeavours',
    track: ['S6', 'S7', 'S8']
  }]

  let highlights = await async.map(data, async section => {
    let trackBuses = section.track

    let matchedBuses = await getBuses(trackBuses)
    let query = {
      date,
      consist: { $in: matchedBuses }
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

  res.render('tracker/bus/highlights', {
    highlights,
    unknownBuses: [],
    unsureBuses: []
  })
})

router.get('/cross-depot', async (req, res) => {
  let { tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let regos = tripDB.getCollection('bus regos')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let crossDepotTrips = await findCrossDepotTrips(busTrips, regos, date)

  let tripsToday = (await async.map(crossDepotTrips, async trip => {
    let { fleetNumber } = await getBusFromRego(regos, trip.consist[0]) || {}

    trip.operator = fleetNumber.match(/^([A-Z]+)/)[1]
    trip.fleetNumber = fleetNumber

    return trip
  })).map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let operators = {}
  tripsToday.forEach(trip => {
    let { operator, fleetNumber } = trip
    if (!operators[operator]) operators[operator] = {}
    if (!operators[operator][fleetNumber]) operators[operator][fleetNumber] = []
    operators[operator][fleetNumber].push(trip)
  })

  res.render('tracker/bus/cross-depot', {
    operators,
    operatorCodes,
    date: utils.parseTime(date, 'YYYYMMDD'),
    depotAllocations
  })
})

router.get('/operator-unknown', async (req, res) => {
  let { db, tripDB } = res
  let busTrips = tripDB.getCollection('bus trips')
  let busRegos = tripDB.getCollection('bus regos')
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
  let allBuses = await busRegos.distinct('rego')

  let operatorServices = manualRoutes[operator] || await routes.distinct('routeGTFSID', {
    operators: operatorName
  })

  let tripsToday = (await busTrips.findDocuments({
    date,
    routeGTFSID: {
      $in: operatorServices
    },
    consist: {
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
      consist: {
        $not: {
          $in: allBuses
        }
      }
    }
  }, {
    $group: {
      _id: '$date',
      regos: {
        $addToSet: '$consist'
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

    let buses = data.regos.flatMap(rego => {
      return '@' + rego
    }).sort((a, b) => a.localeCompare(b))

    return {
      date,
      humanDate,
      data: buses
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

router.initDB = async (db, tripDB) => {
  await generateCrossDepotQuery(await tripDB.getCollection('bus regos'))
}

export default router
