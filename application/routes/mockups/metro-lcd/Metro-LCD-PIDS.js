const express = require('express')
const router = new express.Router()
const utils = require('../../../../utils')
const PIDBackend = require('../PIDBackend')
const csrf = require('../csrf')

let validPIDTypes = ['half-platform-bold', 'half-platform', 'platform', 'pre-platform-vertical']

async function getData(req, res) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, req.params.platform, {}, res.db)
}

router.get('/:station/:platform/:type', csrf, async (req, res, next) => {
  let pidType = req.params.type
  if (!validPIDTypes.includes(pidType)) return next()
  getData(req, res)

  if (pidType === 'pre-platform-vertical') {
    res.render('mockups/fss/escalator', {
      platform: req.params.platform, dark: true,
      csrf: await req.csrfToken()
     })
  } else {
    res.render('mockups/metro-lcd/' + pidType, {
      now: utils.now(),
      csrf: await req.csrfToken()
    })
  }
})

router.post('/:station/:platform/:type', csrf, async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
