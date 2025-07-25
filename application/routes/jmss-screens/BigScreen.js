const express = require('express')
const router = new express.Router()
const ptvAPI = require('../../../ptv-api')
const utils = require('../../../utils')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline-old/get-departures')
const getBusDepartures = require('../../../modules/bus/get-departures')
const busDestinations = require('../../../additional-data/bus-destinations')

function filterDepartures(departures) {
  return departures.map(departure => {
    departure.secondsToDeparture = departure.actualDepartureTime.diff(utils.now(), 'seconds')
    departure.minutesToDeparture = departure.actualDepartureTime.diff(utils.now(), 'minutes')

    return departure
  }).filter(departure => {
    return departure.secondsToDeparture > -30 && !departure.cancelled
  })
}

async function getAllBusDepartures(db) {
  let stops = db.getCollection('stops')

  let busLoop = await stops.findDocument({
    stopName: 'Monash University Bus Loop'
  })
  let wellington = await stops.findDocument({
    stopName: 'Wellington Road/Princes Highway'
  })
  let monash742 = await stops.findDocument({
    stopName: 'Monash University/Research Way'
  })

  let busLoopDepartures = [], wellingtonDepartures = [], monash742Departures = []

  await Promise.all([
    new Promise(async resolve => {
      try { busLoopDepartures = await getBusDepartures(busLoop, db) }
      catch (e) {}
      resolve()
    }),
    new Promise(async resolve => {
      try { wellingtonDepartures = (await getBusDepartures(wellington, db)).filter(d => d.routeNumber === '800') }
      catch (e) {}
      resolve()
    }),
    new Promise(async resolve => {
      try { monash742Departures = await getBusDepartures(monash742, db) }
      catch (e) {}
      resolve()
    })
  ])

  let allDepartures = filterDepartures([...busLoopDepartures, ...wellingtonDepartures, ...monash742Departures])

  allDepartures = allDepartures.map(departure => {
    let destination = utils.getDestinationName(departure.trip.destination)
    let serviceData = busDestinations.service[departure.trip.routeGTFSID] || busDestinations.service[departure.routeNumber] || {}

    departure.destination = serviceData[destination]
      || busDestinations.generic[destination] || destination
      .replace('Gardens', 'Gdns').replace('Station', 'Stn').replace('Middle', 'Mid')

    return departure
  }).filter(departure => !!departure.routeNumber).sort((a, b) => a.routeNumber - b.routeNumber || a.destination.length - b.destination.length)

  let busGroups = allDepartures.map(departure => departure.routeNumber + '-' + departure.trip.gtfsDirection)
    .filter((e, i, a) => a.indexOf(e) === i)
  let busDepartures = busGroups.reduce((acc, group) => {
    acc[group] = allDepartures.filter(departure => departure.routeNumber + '-' + departure.trip.gtfsDirection === group).slice(0, 2)
    return acc
  }, {})

  return Object.values(busDepartures).filter(d => d.length)
}

async function getAllMetroDepartures(db) {
  let stops = db.getCollection('stops')

  let huntingdale = (await stops.findDocument({
    stopName: 'Huntingdale Railway Station'
  }))

  let huntingdaleDepartures = filterDepartures(await getMetroDepartures(huntingdale, db))

  let metroGroups = huntingdaleDepartures.map(departure => departure.trip.direction)
    .filter((e, i, a) => a.indexOf(e) === i)

  return metroGroups.reduce((acc, group) => {
    acc[group] = huntingdaleDepartures.filter(departure => departure.trip.direction === group).slice(0, 2)
    return acc
  }, {})
}

async function getNextVLineDepartures(db) {
  let stops = db.getCollection('stops')

  let clayton = (await stops.findDocument({
    stopName: 'Clayton Railway Station'
  }))

  let vlineDepartures = await getVLineDepartures(clayton, db)
  vlineDepartures = vlineDepartures.map(d => {
    d.actualDepartureTime = d.scheduledDepartureTime
    return d
  })
  vlineDepartures = filterDepartures(vlineDepartures)

  return vlineDepartures.filter(departure => {
    return departure.trip.direction === 'Down' || departure.trip.runID % 2 === 1
  })[0]
}

router.get('/', async (req, res) => {
  res.loggingData = req.headers['user-agent']
  res.render('jmss-screens/big-screen', await utils.getData('jmss-screen', 'big-screen', async () => {
    let busDepartures = [], metroDepartures = [], nextVLineDeparture = null

    await Promise.all([
      new Promise(async resolve => {
        try { busDepartures = await getAllBusDepartures(res.db) }
        catch (e) {}
        resolve()
      }),
      new Promise(async resolve => {
        try { metroDepartures = await getAllMetroDepartures(res.db) }
        catch (e) {}
        resolve()
      }),
      new Promise(async resolve => {
        try { nextVLineDeparture = await getNextVLineDepartures(res.db) }
        catch (e) {}
        resolve()
      })
    ])

    let currentTime = utils.now().format('h:mmA').toLowerCase()
    return { busDepartures, metroDepartures, nextVLineDeparture, currentTime }
  }))
})

module.exports = router
