const express = require('express')
const router = new express.Router()
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')
const PIDUtils = require('../PIDUtils')
const stationDestinations = require('./station-destinations')

async function getData(req, res, maxDepartures) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  return await TrainUtils.getPIDSDepartures(res.db, station, '*', null, null, maxDepartures, true)
}

router.get('/:station/up-down', async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/up-down', { now: utils.now() })
})

router.get('/:station/interchange', async (req, res) => {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/interchange', {
    now: utils.now(),
    stationName,
    destinations
  })
})


router.get('/:station/interchange/destinations', async (req, res) => {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []

  res.json(destinations)
})


router.post('/:station/up-down', async (req, res) => {
  let departures = await getData(req, res, 8)
  res.json(departures)
})


router.post('/:station/interchange', async (req, res) => {
  let departures = await getData(req, res, Infinity)
  let groupedDepartures = {}

  departures.departures.forEach(departure => {
    let key = departure.routeName + departure.direction
    if (!groupedDepartures[key]) groupedDepartures[key] = []
    groupedDepartures[key].push(departure)
  })

  departures.departures = Object.values(groupedDepartures).reduce((acc, group) => {
    return acc.concat(group.slice(0, 3))
  }, [])

  res.json(departures)
})

module.exports = router
