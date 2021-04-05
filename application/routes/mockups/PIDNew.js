const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const PIDBackend = require('./PIDBackend')
const PIDUtils = require('./PIDUtils')

async function getData(req, res) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  return await PIDBackend.getPIDData(station, req.params.platform, res.db)
}

router.get('/:station/:platform', async (req, res) => {
  res.json(await getData(req, res))
})

module.exports = router
