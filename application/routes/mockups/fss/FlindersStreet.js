const express = require('express')
const router = new express.Router()
const async = require('async')
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')

let stoppingTextMap = {
  stopsAll: 'Stops All Stations',
  allExcept: 'Not Stopping At {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  thenRunsExpressAtoB: 'then Runs Express from {0} to {1}',
  sasTo: 'Stops All Stations to {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}

let stoppingTypeMap = {
  vlineService: {
    stoppingType: 'No Suburban Passengers'
  },
  sas: 'Stops All',
  limExp: 'Ltd Express',
  exp: 'Express'
}

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: (req.params.station || 'flinders-street') + '-railway-station'
  })
  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, stoppingTextMap, stoppingTypeMap)
}

router.get('/escalator/:platform/:station*?', async (req, res) => {
  res.render('mockups/fss/escalator', {platform: req.params.platform})
})

router.get('/platform/:platform/:station*?', async (req, res) => {
  res.render('mockups/fss/platform', {platform: req.params.platform})
})

router.post('/:type/:platform/:station*?', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

router.get('/trains-from-fss', async (req, res) => {
  res.render('mockups/fss/trains-from-fss', { now: utils.now() })
})

router.post('/trains-from-fss', async (req, res) => {
  let departures = await getData({ params: { platform: '*' } }, res)
  res.json(departures)
})

module.exports = router
