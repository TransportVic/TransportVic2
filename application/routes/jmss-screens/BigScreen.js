const express = require('express')
const router = new express.Router()
const ptvAPI = require('../../../ptv-api')
const TimedCache = require('timed-cache')
const moment = require('moment')
const utils = require('../../../utils')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const getBusDepartures = require('../../../modules/bus/get-departures')
const busDestinations = require('../../../additional-data/bus-destinations')
let EventEmitter = require('events')

let cache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })

let lock = null

function filterDepartures(departures) {
  return departures.map(departure => {
    departure.secondsToDeparture = departure.actualDepartureTime.diff(utils.now(), 'seconds')
    departure.minutesToDeparture = departure.actualDepartureTime.diff(utils.now(), 'minutes')

    return departure
  }).filter(departure => {
    return departure.secondsToDeparture > -30 && !departure.cancelled
  })
}

router.get('/', async (req, res) => {
  if (lock) {
    return await new Promise(resolve => {
      lock.on('done', data => {
        res.render('jmss-screens/big-screen', data)
      })
    })
  }

  lock = new EventEmitter()

  let stops = res.db.getCollection('stops')

  let busLoop = await stops.findDocument({
    stopName: 'Monash University Bus Loop'
  })
  let wellington = await stops.findDocument({
    stopName: 'Wellington Road/Princes Highway'
  })
  let monash742 = await stops.findDocument({
    stopName: 'Monash University/Research Way'
  })

  let busLoopDepartures = await getBusDepartures(busLoop, res.db)
  let wellingtonDepartures = (await getBusDepartures(wellington, res.db)).filter(d => d.routeNumber === '800')
  let monash742Departures = await getBusDepartures(monash742, res.db)

  let allDepartures = filterDepartures([...busLoopDepartures, ...wellingtonDepartures, ...monash742Departures])

  allDepartures = allDepartures.map(departure => {
    let serviceData = busDestinations.service[departure.routeNumber] || busDestinations.service[departure.trip.routeGTFSID] || {}

    let fullDestination = departure.trip.destination
    let destinationShortName = departure.trip.destination.split('/')[0]
    let {destination} = departure.trip
    if (!utils.isStreet(destinationShortName)) destination = destinationShortName
    departure.destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

    departure.destination = (serviceData[departure.destination]
      || busDestinations.generic[departure.destination]
      || busDestinations.generic[fullDestination] || departure.destination)
      .replace('Gardens', 'Gdns').replace('Station', 'Stn').replace('Middle', 'Mid')

    return departure
  }).filter(departure => !!departure.routeNumber).sort((a, b) => a.routeNumber - b.routeNumber || a.destination.length - b.destination.length)

  let busGroups = allDepartures.map(departure => departure.routeNumber + '-' + departure.trip.gtfsDirection)
    .filter((e, i, a) => a.indexOf(e) === i)
  let busDepartures = busGroups.reduce((acc, group) => {
    acc[group] = allDepartures.filter(departure => departure.routeNumber + '-' + departure.trip.gtfsDirection === group).slice(0, 2)
    return acc
  }, {})

  busDepartures = Object.values(busDepartures).filter(d => d.length)

  const huntingdale = (await stops.findDocument({
    stopName: 'Huntingdale Railway Station'
  }))
  const clayton = (await stops.findDocument({
    stopName: 'Clayton Railway Station'
  }))

  let huntingdaleDepartures = filterDepartures(await getMetroDepartures(huntingdale, res.db))

  let metroGroups = huntingdaleDepartures.map(departure => departure.trip.direction)
    .filter((e, i, a) => a.indexOf(e) === i)
  let metroDepartures = metroGroups.reduce((acc, group) => {
    acc[group] = huntingdaleDepartures.filter(departure => departure.trip.direction === group).slice(0, 2)
    return acc
  }, {})

  let vlineDepartures = await getVLineDepartures(clayton, res.db)
  vlineDepartures = vlineDepartures.map(d => {
    d.actualDepartureTime = d.scheduledDepartureTime
    return d
  })
  vlineDepartures = filterDepartures(vlineDepartures)
  let nextVLineDeparture = vlineDepartures.filter(departure => {
    return departure.trip.direction === 'Down' || departure.trip.runID % 2 === 1
  })[0]

  let currentTime = utils.now().format('h:mmA').toLowerCase()

  let data = { busDepartures, metroDepartures, nextVLineDeparture, currentTime }
  lock.emit('done', data)
  lock = null

  res.render('jmss-screens/big-screen', data)
})

module.exports = router
