const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const PIDBackend = require('./PIDBackend')

async function getData(req, res) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, req.params.platform, {}, res.db)
}

router.get('/:station/:platform', async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-crt', { now: utils.now() })
})

router.post('/:station/:platform/', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
