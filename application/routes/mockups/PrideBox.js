const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')
const config = require('../../../config')

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let departures = (await getDepartures(station, res.db, 3, false, req.params.platform, 1))
    .filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')
      return minutesDifference < 180 && secondsDifference >= 10 // minutes round down
      return true
    })

  return departures
}

router.get('/', async (req, res) => {
  res.render('mockups/pride/pride.pug')
})

router.use('/audio', express.static(config.audiopath))


router.post('/:station/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json({departures})
})

module.exports = router
