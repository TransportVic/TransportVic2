const express = require('express')
const router = new express.Router()
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')

let validPIDTypes = ['escalator', 'platform']

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: (req.params.station || 'flinders-street') + '-railway-station'
  })

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, null, null, req.params.maxDepartures || 5)
}

router.get('/:type/:platform/:station*?', async (req, res, next) => {
  let pidType = req.params.type
  if (!validPIDTypes.includes(pidType)) return next()

  res.render('mockups/fss/' + pidType, { platform: req.params.platform, now: utils.now() })
})

router.post('/:type/:platform/:station*?', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

router.get('/trains-from-fss', async (req, res) => {
  res.render('mockups/fss/trains-from-fss', { now: utils.now() })
})

router.post('/trains-from-fss', async (req, res) => {
  let departures = await getData({ params: { platform: '*', maxDepartures: 20 } }, res)
  res.json(departures)
})

module.exports = router
