const express = require('express')
const router = new express.Router()
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')
const PIDUtils = require('../PIDUtils')

let validPIDTypes = ['half-platform-bold', 'half-platform', 'platform', 'pre-platform-vertical']

async function getData(req, res) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, null, null, 5)
}

router.get('/:station/:platform/:type', async (req, res, next) => {
  let pidType = req.params.type
  if (!validPIDTypes.includes(pidType)) return next()
  setTimeout(async () => await getData(req, res), 0)

  if (pidType === 'pre-platform-vertical') {
    res.render('mockups/fss/escalator', { platform: req.params.platform, dark: true })
  } else {
    res.render('mockups/metro-lcd/' + pidType, { now: utils.now() })
  }
})

router.post('/:station/:platform/:type', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
