const express = require('express')
const router = new express.Router()
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')
const stationDestinations = require('./station-destinations')

async function getData(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  return await TrainUtils.getPIDSDepartures(res.db, station, '*', null, null, 15)
}

router.get('/:station/up-down', async (req, res) => {
  res.render('mockups/metro-lcd/concourse/up-down', { now: utils.now() })
})

router.get('/:station/interchange', async (req, res) => {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []

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



router.post('/:station/:type', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
