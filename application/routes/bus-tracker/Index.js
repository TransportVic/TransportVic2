const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const busDestinations = require('../../../modules/bus/bus-destinations')

const highlightData = require('../../../additional-data/tracker-highlights')

let manualRoutes = {
  "CO": ["4-601", "4-60S", "4-612", "4-623", "4-624", "4-625", "4-626", "4-630", "4-900"],
  "CS": ["4-406", "4-407", "4-408", "4-409", "4-410", "4-418", "4-419", "4-421", "4-423", "4-424", "4-425", "4-461"],
  "CW": ["4-150", "4-151", "4-153", "4-160", "4-161", "4-166", "4-167", "4-170", "4-180", "4-181", "4-190", "4-191", "4-192", "4-400", "4-411", "4-412", "4-414", "4-415", "4-417", "4-439", "4-441", "4-443", "4-494", "4-495", "4-496", "4-497", "4-498", "4-606"],
}

const operators = {
  "Ventura Bus Lines": "V",
  "CDC Oakleigh": "CO",
  "CDC Sunshine": "CS",
  "CDC Wyndham": "CW",
  "Tullamarine Bus Lines": "CT",
  "CDC Geelong": "CG",
  "CDC Ballarat": "CB",
  "Transdev Melbourne": "T",
  "Sita Bus Lines": "S",
  "Dysons": "D",
  "Cranbourne Transit": "CR",
  "Sunbury Bus Service": "SB",
  "Latrobe Valley Bus Lines": "LT",
  "McHarrys Bus Lines": "MH",
  "McKenzies Tourist Service": "MK",
  "Martyrs Bus Service": "MT",
  "Ryan Bros Bus Service": "RB",
  "Moreland Bus Lines": "ML",
  "Moonee Valley Bus Lines": "MV",
  "Kastoria Bus Lines": "K",
  "Broadmeadows Bus Service": "B",
  "Panorama Coaches": "P",
  "Christians Bus Company (Bendigo)": "CC"
}

router.get('/', (req, res) => {
  res.render('tracker/index', {
    operators: Object.keys(operators)
  })
})

function adjustTrip(trip) {
  let {origin, destination} = trip
  let serviceData = busDestinations.service[trip.routeNumber] || {}
  let dA = destination, dB = destination.split('/')[0]
  let oA = origin, oB = origin.split('/')[0]

  trip.destination = (serviceData[dA] || serviceData[dB]
    || busDestinations.generic[dA] || busDestinations.generic[dB] || dB).replace('Shopping Centre', 'SC')
  trip.origin = (serviceData[oA] || serviceData[oB]
    || busDestinations.generic[oA] || busDestinations.generic[oB] || oB).replace('Shopping Centre', 'SC')

  return trip
}

router.get('/bus', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
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

  tripsToday = tripsToday.map(adjustTrip)

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
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {service} = querystring.parse(url.parse(req.url).query)
  if (!service) return res.end()

  let originalService = service
  service = {
    $in: service.split('|')
  }

  let rawTripsToday = await busTrips.findDocuments({
    date,
    routeNumber: service
  }).sort({departureTime: 1, origin: 1}).toArray()

  let activeTripsNow = rawTripsToday.filter(trip => {
    let {departureTime, destinationArrivalTime} = trip
    let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
        destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

    return minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  let tripsToday = (await async.map(activeTripsNow, async rawTrip => {
    let {fleetNumber} = await smartrakIDs.findDocument({
      smartrakID: rawTrip.smartrakID
    }) || {}

    let {origin, destination, departureTime} = rawTrip

    rawTrip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + rawTrip.smartrakID
    return rawTrip
  }))

  tripsToday = tripsToday.map(adjustTrip)

  let operationDays = await busTrips.distinct('date', {
    routeNumber: service
  })
  let busesByDay = {}
  let smartrakIDCache = {}

  await async.forEach(operationDays, async date => {
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

    busesByDay[date] = buses
  })

  res.render('tracker/service', {tripsToday, busesByDay, date, service: originalService})
})

router.get('/unknown', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let routes = db.getCollection('routes')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {operator} = querystring.parse(url.parse(req.url).query)
  if (!operator) return res.end()

  let operatorCode = operators[operator]
  let allBuses = await smartrakIDs.distinct('smartrakID')

  let operatorServices = (await routes.distinct('routeGTFSID', {
    operators: operator
  })).concat(manualRoutes[operatorCode] || [])

  let rawTripsToday = await busTrips.findDocuments({
    date,
    routeGTFSID: {
      $in: operatorServices
    },
    smartrakID: {
      $not: {
        $in: allBuses
      }
    }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let allTime = await busTrips.findDocuments({
    routeGTFSID: {
      $in: operatorServices
    },
    smartrakID: {
      $not: {
        $in: allBuses
      }
    }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let activeTripsNow = rawTripsToday.filter(trip => {
    let destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(trip.destinationArrivalTime)

    return minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  activeTripsNow = activeTripsNow.map(adjustTrip)

  let busSummary = allTime.reduce((acc, trip) => {
    if (!acc[trip.smartrakID]) acc[trip.smartrakID] = {}
    acc[trip.smartrakID][trip.routeNumber] = ''
    return acc
  }, {})

  res.render('tracker/unknown', {activeTripsNow, busSummary})
})

router.get('/highlights', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let routes = db.getCollection('routes')
  let date = utils.getYYYYMMDDNow()

  async function getBuses(fleets) {
    return await smartrakIDs.distinct('smartrakID', { fleetNumber: { $in: fleets } })
  }

  let venturaMinibuses = await getBuses(highlightData.ventura_minibus)
  let strayMinibuses = await busTrips.findDocuments({
    date,
    smartrakID: { $in: venturaMinibuses },
    routeNumber: { $not: { $in: highlightData.ventura_minibus_routes} }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let venturaArtics = await getBuses(highlightData.ventura_artics)
  let strayArtics = await busTrips.findDocuments({
    date,
    smartrakID: { $in: venturaArtics },
    routeNumber: { $not: { $in: highlightData.ventura_artic_routes } }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let venturaSpecials = await getBuses(highlightData.ventura_specials)
  let straySpecials = await busTrips.findDocuments({
    date,
    smartrakID: { $in: venturaSpecials }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let venturaB10BLE = await getBuses(highlightData.ventura_b10ble)
  let strayB10BLEs = await busTrips.findDocuments({
    date,
    smartrakID: { $in: venturaB10BLE },
    routeNumber: '828'
  }).sort({departureTime: 1, origin: 1}).toArray()

  let transdevNonorbitalSmartbus = await getBuses(highlightData.transdev_nonorbital_smartbuses)
  let strayNonorbitals = await busTrips.findDocuments({
    date,
    smartrakID: { $in: transdevNonorbitalSmartbus },
    routeNumber: { $in: highlightData.transdev_smartbus_orbital_routes }
  }).sort({departureTime: 1, origin: 1}).toArray()


  let cranbourneO405NH = await getBuses(highlightData.cranbourne_o405nh)
  let strayO405NH = await busTrips.findDocuments({
    date,
    smartrakID: { $in: cranbourneO405NH },
    routeNumber: { $in: highlightData.cranbourne_o405nh_unusual_services }
  }).sort({departureTime: 1, origin: 1}).toArray()


  let routeLiveryBuses = await getBuses(highlightData.route_livery_buses)
  let strayLiveryBuses = await busTrips.findDocuments({
    date,
    smartrakID: { $in: routeLiveryBuses },
    routeNumber: { $not: { $in: highlightData.route_livery_services } }
  }).sort({departureTime: 1, origin: 1}).toArray()


  let sitaOld = await getBuses(highlightData.sita_old)
  let straySitaOld = await busTrips.findDocuments({
    date,
    smartrakID: { $in: sitaOld },
  }).sort({departureTime: 1, origin: 1}).toArray()


  let ninehundredPerms = await getBuses(highlightData.ninehundred_perms)
  let stray900Perm = await busTrips.findDocuments({
    date,
    smartrakID: { $in: ninehundredPerms },
    routeNumber: { $ne: '900' }
  }).sort({departureTime: 1, origin: 1}).toArray()
  let non900Perm = await busTrips.findDocuments({
    date,
    smartrakID: { $not: { $in: ninehundredPerms } },
    routeNumber: '900'
  }).sort({departureTime: 1, origin: 1}).toArray()

  let cdcHybrids = await getBuses(highlightData.cdc_oakleigh_hybrids)
  let strayCOHybrids = await busTrips.findDocuments({
    date,
    smartrakID: { $in: cdcHybrids },
    routeNumber: { $not: { $in: highlightData.cdc_oakleigh_hybrid_routes } }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let tullaSpecialsBuses = await getBuses(highlightData.tulla_specials)
  let tullaSpecials = await busTrips.findDocuments({
    date,
    smartrakID: { $in: tullaSpecialsBuses }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let sunburySpecialsBuses = await getBuses(highlightData.sunbury_specials)
  let sunburySpecials = await busTrips.findDocuments({
    date,
    smartrakID: { $in: sunburySpecialsBuses }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let allBuses = await smartrakIDs.findDocuments().toArray()
  let trackUnknownRoutes = await routes.distinct('routeGTFSID', {
    operators: { $in: highlightData.report_unknown }
  })

  trackUnknownRoutes = trackUnknownRoutes.concat(manualRoutes.CO)

  let unknownBuses = await busTrips.findDocuments({
    date,
    routeGTFSID: { $in: trackUnknownRoutes },
    smartrakID: { $not: { $in: allBuses.map(bus => bus.smartrakID) } }
  }).sort({departureTime: 1, origin: 1}).toArray()

  res.render('tracker/highlights', {
    strayMinibuses,
    strayArtics,
    straySpecials,
    strayB10BLEs,
    strayNonorbitals,
    strayO405NH,
    strayLiveryBuses,
    straySitaOld,
    stray900Perm,
    non900Perm,
    unknownBuses,
    strayCOHybrids,
    tullaSpecials,
    sunburySpecials,
    busMapping: allBuses.reduce((acc, bus) => {
      acc[bus.smartrakID] = bus.fleetNumber
      return acc
    }, {}),
    busDestinations
  })
})

module.exports = router
