import async from 'async'
import express from 'express'
import utils from '../../../utils.mjs'
import url from 'url'
import querystring from 'querystring'
import tramDestinations from '../../../additional-data/tram-destinations.json' with { type: 'json' }
import tramFleet from '../../../additional-data/tram-tracker/tram-fleet.js'
import knownTrams from '../../../additional-data/tram-tracker/known-tram-fleet.json' with { type: 'json' }
import tramDepots from '../../../additional-data/tram-tracker/depot-allocations.json' with { type: 'json' }
import serviceDepots from '../../../additional-data/tram-tracker/service-depots.json' with { type: 'json' }

const router = new express.Router()

let crossDepotQuery = {
  $or: []
}

function addShortWorkings(services) {
  return services.map(service => {
    return [service, service + 'a', service + 'd']
  }).reduce((a, e) => a.concat(e), [])
}

let fullDepotServices = {}
Object.keys(serviceDepots).forEach(depot => {
  let services = serviceDepots[depot]
  fullDepotServices[depot] = addShortWorkings(services)
})

Object.keys(tramDepots).forEach(tram => {
  let depot = tramDepots[tram]

  crossDepotQuery.$or.push({
    consist: tram,
    routeNumber: {
      $not: {
        $in: fullDepotServices[depot]
      }
    }
  })
})

async function findCrossDepotTrips(tramTrips, date) {
  let crossDepotQueryOnDate = {
    $or: crossDepotQuery.$or.map(e => {
      return {
        ...e,
        date
      }
    })
  }

  let crossDepotTrips = await tramTrips.findDocuments(crossDepotQueryOnDate)
    .sort({departureTime: 1}).toArray()

  return crossDepotTrips
}

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
  let e = utils.encodeName
  trip.url = `/tram/run/${e(trip.origin)}/${trip.departureTime}/${e(trip.destination)}/${trip.destinationArrivalTime}/${trip.date}`

  let origin = utils.getDestinationName(trip.origin)
  let destination = utils.getDestinationName(trip.destination)

  trip.destination = tramDestinations[destination] || destination
  trip.origin = tramDestinations[origin] || origin

  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)
  let destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)
  if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  trip.tram = `${tramFleet.getModel(trip.consist[0])}.${trip.consist[0]}`

  return trip
}

router.get('/', (req, res) => {
  res.render('tracker/tram/index')
})

router.get('/fleet', async (req, res) => {
  let { tripDB } = res
  let tramTrips = tripDB.getCollection('tram trips')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {fleet, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!fleet) {
    return res.render('tracker/tram/by-fleet', {
      tripsToday: [],
      servicesByDay: {},
      fleet: '?',
      date: utils.parseTime(date, 'YYYYMMDD')
    })
  }

  let query = {
    date,
    consist: fleet
  }

  let tripsToday = await tramTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  tripsToday = tripsToday.map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let allDates = (await tramTrips.distinct('date', { consist: fleet })).reverse().slice(0, 60)

  let servicesByDay = await async.map(allDates, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    let services = await tramTrips.distinct('routeNumber', { date, consist: fleet })

    return {
      date,
      humanDate,
      services: services.sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
    }
  })

  let model = tramFleet.getModel(fleet)

  res.render('tracker/tram/by-fleet', {
    tripsToday,
    servicesByDay,
    fleet,
    tram: `${model}.${fleet}`,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})


router.get('/service', async (req, res) => {
  let { tripDB } = res
  let tramTrips = tripDB.getCollection('tram trips')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {service, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!service) {
    return res.render('tracker/tram/by-service', {
      tripsToday: [],
      tramsByDay: {},
      service: '',
      date: utils.parseTime(date, 'YYYYMMDD')
    })
  }

  let routeQuery = {
    $in: [
      service, service + 'a', service + 'd' // Optimise for core route
    ]
  }

  let rawTripsToday = await tramTrips.findDocuments({
    date,
    routeNumber: routeQuery
  }).sort({departureTime: 1, origin: 1}).toArray()

  let tripsToday = rawTripsToday.map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let allDates = (await tramTrips.distinct('date', { routeNumber: service })).reverse().slice(0, 60)

  let tramsByDay = await async.map(allDates, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    let trams = await tramTrips.distinct('consist', { routeNumber: service, date })

    return {
      date,
      humanDate,
      trams: trams.sort((a, b) => a - b).map(tram => {
        let model = tramFleet.getModel(tram)
        return model + '.' + tram
      })
    }
  })

  res.render('tracker/tram/by-service', {
    tripsToday,
    tramsByDay,
    service,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})


router.get('/shift', async (req, res) => {
  let { tripDB } = res
  let tramTrips = tripDB.getCollection('tram trips')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {shift, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  if (!shift) {
    return res.render('tracker/tram/by-shift', {
      tripsToday: [],
      tramsByDay: {},
      shift: '?',
      date: utils.parseTime(date, 'YYYYMMDD')
    })
  }

  shift = shift.toUpperCase()

  let query = {
    date,
    shift
  }

  let tripsToday = await tramTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  tripsToday = tripsToday.map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  let allDates = (await tramTrips.distinct('date', { shift })).reverse().slice(0, 60)

  let tramsByDay = await async.map(allDates, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    let trams = await tramTrips.distinct('consist', { shift, date })

    return {
      date,
      humanDate,
      trams: trams.sort((a, b) => a - b).map(tram => {
        let model = tramFleet.getModel(tram)
        return model + '.' + tram
      })
    }
  })

  res.render('tracker/tram/by-shift', {
    tripsToday,
    tramsByDay,
    shift,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/cross-depot', async (req, res) => {
  let { tripDB } = res
  let tramTrips = tripDB.getCollection('tram trips')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let crossDepotTrips = await findCrossDepotTrips(tramTrips, date)

  let tripsToday = crossDepotTrips.map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  res.render('tracker/tram/cross-depot', {
    tripsToday,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/highlights', async (req, res) => {
  let { tripDB } = res
  let tramTrips = tripDB.getCollection('tram trips')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let unknownTrams = (await tramTrips.findDocuments({
    date: date,
    consist: {
      $not: {
        $in: knownTrams.map(t => t.toString())
      }
    }
  }).sort({departureTime: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))

  res.render('tracker/tram/highlights', {
    date: utils.parseTime(date, 'YYYYMMDD'),
    unknownTrams
  })
})

router.get('/full-list', async (req, res) => {
  let { tripDB } = res
  let tramTrips = tripDB.getCollection('tram trips')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let today = utils.getYYYYMMDDNow()

  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let allTrams = knownTrams.map(tram => ({
    tram: tram,
    fleetNumber: `${tramFleet.getModel(tram)}.${tram}`
  }))

  let rawTripsToday = await tramTrips.findDocuments({
    date
  }, { routeNumber: 1, consist: 1 }).sort({ routeNumber: 1 }).toArray()

  let trams = {}
  rawTripsToday.forEach(trip => {
    let fleetNumber = `${tramFleet.getModel(trip.consist[0])}.${trip.consist[0]}`

    if (!trams[fleetNumber]) trams[fleetNumber] = []
    if (!trams[fleetNumber].includes(trip.routeNumber)) {
      trams[fleetNumber].push(trip.routeNumber)
    }
  })

  return res.render('tracker/tram/full-list', {
    trams,
    allTrams,
    date: utils.parseTime(date, 'YYYYMMDD'),
    rawDate: date
  })
})

export default router