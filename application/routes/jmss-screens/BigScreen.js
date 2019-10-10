const express = require('express')
const router = new express.Router()
const ptvAPI = require('../../../ptv-api')
const TimedCache = require('timed-cache')
const moment = require('moment')
const utils = require('../../../utils')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')

let cache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })

async function getBusLoopDepartures() {
  if (cache.get('bus loop')) return cache.get('bus loop')
  const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/2/stop/33430?&max_results=3&expand=run&expand=route`)

  let mappedDepartures = []
  departures.forEach(departure => {
    let scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    let estimatedDepartureTime = departure.estimated_departure_utc ? moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne') : null
    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

    let runID = departure.run_id
    let routeID = departure.route_id

    let run = runs[runID]
    let route = routes[routeID]

    let destination = run.destination_name.split('/')[0]
    destination = destination.replace('Gardens', 'Gdns').replace('Shopping Centre', 'SC')
      .replace('Railway', '').replace('Station', 'Stn').replace('Middle', 'Mid')
    if (destination === 'Knox City SC Interchange')
      destination = 'Knox City SC'
    let routeNumber = route.route_number
    if (routeNumber.includes('combined')) return
    let direction = run.direction_id

    mappedDepartures.push({
      estimatedDepartureTime,
      actualDepartureTime,
      routeNumber,
      destination,
      direction
    })
  })

  mappedDepartures = mappedDepartures.sort((a, b) => {
    return a.routeNumber - b.routeNumber || a.destination.length - b.destination.length
  })

  cache.put('bus loop', mappedDepartures)
  return mappedDepartures
}

function filterDepartures(departures) {
  return departures.map(departure => {
    departure.secondsToDeparture = departure.actualDepartureTime.diff(utils.now(), 'seconds')
    departure.minutesToDeparture = departure.actualDepartureTime.diff(utils.now(), 'minutes')

    return departure
  }).filter(departure => {
    return departure.secondsToDeparture > -30
  })
}

router.get('/', async (req, res) => {
  let busLoopDepartures = filterDepartures(await getBusLoopDepartures())

  let busGroups = busLoopDepartures.map(departure => departure.routeNumber + '-' + departure.direction)
    .filter((e, i, a) => a.indexOf(e) === i)
  let busDepartures = busGroups.reduce((acc, group) => {
    acc[group] = busLoopDepartures.filter(departure => departure.routeNumber + '-' + departure.direction === group).slice(0, 2)
    return acc
  }, {})

  busDepartures = Object.values(busDepartures)

  const huntingdale = (await res.db.getCollection('stops').findDocument({
    stopName: 'Huntingdale Railway Station'
  }))
  const clayton = (await res.db.getCollection('stops').findDocument({
    stopName: 'Clayton Railway Station'
  }))

  let huntingdaleDepartures = filterDepartures(await getMetroDepartures(huntingdale, res.db, 3, false))

  let metroGroups = huntingdaleDepartures.map(departure => departure.trip.direction)
    .filter((e, i, a) => a.indexOf(e) === i)
  let metroDepartures = metroGroups.reduce((acc, group) => {
    acc[group] = huntingdaleDepartures.filter(departure => departure.trip.direction === group).slice(0, 2)
    return acc
  }, {})

  let vlineDepartures = await getVLineDepartures(clayton, res.db)
  vlineDepartures = filterDepartures(vlineDepartures)
  let nextVLineDeparture = vlineDepartures.filter(departure => {
    return departure.trip.direction === 'Down' || departure.trip.runID % 2 === 1
  })[0]

  let currentTime = utils.now().format('h:mmA').toLowerCase()

  res.render('jmss-screens/big-screen', { busDepartures, metroDepartures, nextVLineDeparture, currentTime })
})

module.exports = router
