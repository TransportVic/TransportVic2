const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')

const highlightData = require('../../../additional-data/tracker-highlights')

const operators = {
  "Ventura Bus Lines": "V",
  "CDC Melbourne": {
    $in: ["CO", "CS", "CW"]
  },
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

  let operatorServices = await routes.distinct('routeGTFSID', {
    operators: operator
  })

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
    routeNumber: { $in: highlightData.ventura_minibus_routes}
  }).sort({departureTime: 1, origin: 1}).toArray()

  let venturaArtics = await getBuses(highlightData.ventura_artics)
  let strayArtics = await busTrips.findDocuments({
    date,
    smartrakID: { $in: venturaArtics },
    routeNumber: { $in: highlightData.ventura_artic_routes }
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
    routeNumber: { $in: highlightData.route_livery_services }
  }).sort({departureTime: 1, origin: 1}).toArray()


  let sitaOld = await getBuses(highlightData.sita_old)
  let straySitaOld = await busTrips.findDocuments({
    date,
    smartrakID: { $in: sitaOld },
  }).sort({departureTime: 1, origin: 1}).toArray()

  let allBuses = await smartrakIDs.distinct('smartrakID')
  let trackUnknownRoutes = await routes.distinct('routeGTFSID', {
    operators: { $in: highlightData.report_unknown }
  })
  let unknownBuses = await busTrips.findDocuments({
    date,
    routeGTFSID: { $in: trackUnknownRoutes },
    smartrakID: { $not: { $in: allBuses } }
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
    unknownBuses
  })
})

module.exports = router
