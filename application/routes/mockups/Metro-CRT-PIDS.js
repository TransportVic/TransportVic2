const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const TrainUtils = require('./TrainUtils')
const PIDUtils = require('./PIDUtils')

async function getData(req, res) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, null, null)
}

router.get('/:station/:platform', async (req, res) => {
  setTimeout(async () => await getData(req, res), 0)

  res.render('mockups/metro-crt', { now: utils.now() })
})

router.post('/:station/:platform/', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
