const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const PIDBackend = require('./PIDBackend')

let stoppingTypeMap = {
  notTakingPax: 'Not Taking Passengers',
  stopsAll: 'Stops All',
  limitedExpress: 'Limited Express',
  express: 'Express'
}

let rrlStations = [ 'footscray', 'sunshine' ]

async function getData(req, res) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  if (station.bays.find(bay => bay.mode === 'regional train')) {
    let metro = station.bays.find(bay => bay.mode === 'metro train')
    if (metro && !rrlStations.includes(req.params.station)) return { dep: [] }
  } else return { dep: [] }

  return await PIDBackend.getPIDData(station, req.params.platform, {
    stoppingType: stoppingTypeMap
  }, res.db)
}

router.get('/:station/:platform', async (req, res) => {
  getData(req, res)

  res.render('mockups/vline/half-platform', { now: utils.now() })
})

router.post('/:station/:platform/', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
