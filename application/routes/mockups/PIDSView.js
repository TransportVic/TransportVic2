const express = require('express')
const router = new express.Router()
const TrainUtils = require('./TrainUtils')
const stationCodes = require('../../../additional-data/station-codes.json')
const stationPlatforms = require('../../../additional-data/station-platforms.json')
const utils = require('../../../utils')
const url = require('url')
const querystring = require('querystring')

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
  let stationCode = req.headers.host.split('.')[0].toUpperCase()
  let stationName = stationCodes[stationCode].toLowerCase().replace(/ /g, '-')

  let station = await res.db.getCollection('stops').findDocument({
    codedName: stationName + '-railway-station'
  })

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, stoppingTextMap, stoppingTypeMap)
}

function filter(req, next) {
  let host = req.headers.host || ''
  if (host.includes('pidsview')) return true
  else return void next()
}

router.get('/:platform/:type', async (req, res, next) => {
  if (filter(req, next)) {
    let {platform, type} = req.params
    let now = utils.now()

    if (type === 'half-platform') {
      res.render('mockups/metro-lcd/half-platform', { now })
    } if (type === 'platform') {
      res.render('mockups/metro-lcd/platform', { now })
    } else if (type === 'half-platform-bold') {
      res.render('mockups/metro-lcd/half-platform-bold', { now })
    } else if (type === 'fss-escalator') {
      res.render('mockups/fss/escalator', { platform, now })
    } else if (type === 'fss-platform') {
      res.render('mockups/fss/platform')
    }
  }
})

router.get('/summary', async (req, res, next) => {
  if (filter(req, next)) {
    let query = querystring.parse(url.parse(req.url).query)

    let stationCode = req.headers.host.split('.')[0].toUpperCase()
    let stationName = stationCodes[stationCode]
    let codedStationName = stationName.toLowerCase().replace(/ /g, '-')
    let stationPlatformData = stationPlatforms[stationName]

    res.render('mockups/summary', {query, station: codedStationName, stationPlatformData, stationCode})
  }
})

router.post('/:platform/:type', async (req, res, next) => {
  if (filter(req, next)) {
    let departures = await getData(req, res)
    res.json(departures)
  }
})

module.exports = router
