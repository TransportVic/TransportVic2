const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const TrainUtils = require('./TrainUtils')
const PIDUtils = require('./PIDUtils')

let stoppingTypeMap = {
  sas: 'Stops All',
  limExp: 'Limited Express',
  exp: 'Express'
}

let rrlStations = [ 'footscray', 'sunshine' ]

async function getData(req, res) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  if (station.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)) {
    let metro = station.bays.find(bay => bay.mode === 'metro train')
    if (metro && !rrlStations.includes(req.params.station)) return { departures: [] }
  } else return { departures: [] }

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, null, stoppingTypeMap)
}

router.get('/:station/:platform', async (req, res) => {
  setTimeout(async () => await getData(req, res), 0)

  res.render('mockups/vline/half-platform', { now: utils.now() })
})

router.post('/:station/:platform/', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
