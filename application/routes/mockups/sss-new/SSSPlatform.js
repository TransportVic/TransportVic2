const express = require('express')
const router = new express.Router()
const moment = require('moment')
const async = require('async')
const utils = require('../../../../utils')

const PIDBackend = require('../PIDBackend')

async function getData(req, res) {
  let station = await PIDBackend.getStation('southern-cross', res.db)

  let platforms = req.params.platform.split('-')

  let left = await PIDBackend.getPIDData(station, platforms[0], {}, res.db)
  let right = await PIDBackend.getPIDData(station, platforms[1], {}, res.db)

  return { left: left.dep, right: right.dep }
}

router.get('/:platform', async (req, res) => {
  getData(req, res)

  res.render('mockups/sss-new/platform.pug', { now: utils.now() })
})

router.post('/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json(departures)
})

module.exports = router
