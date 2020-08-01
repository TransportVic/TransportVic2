const express = require('express')
const router = new express.Router()
const moment = require('moment')
const async = require('async')

const TrainUtils = require('../TrainUtils')

let stoppingTextMap = {
  stopsAll: 'Stops All Stations',
  allExcept: 'All Except {0}',
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
    stoppingType: 'V/Line Service',
    stoppingPatternPostfix: ', Not Taking Suburban Passengers'
  },
  sas: 'Stops All Stations',
  limExp: 'Limited Express',
  exp: 'Express Service'
}

async function getData(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: 'southern-cross-railway-station'
  })

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, stoppingTextMap, stoppingTypeMap)
}

router.get('/:platform', async (req, res) => {
  res.render('mockups/sss-new/platform.pug')
})

router.post('/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json(departures)
})

module.exports = router
