const express = require('express')
const router = new express.Router()
const TrainUtils = require('./TrainUtils')
const stationCodes = require('../../../additional-data/station-codes.json')
const url = require('url')
const querystring = require('querystring')

let cityStations = ['southern-cross', 'parliament', 'flagstaff', 'melbourne-central', 'flinders-street']

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
    if (type === 'suburban-list') {
      res.render('mockups/metro-lcd-pids/list-pids')
    } else if (type === 'suburban-text') {
      res.render('mockups/metro-lcd-pids/pids')
    } else if (type === 'fss-escalator') {
      res.render('mockups/flinders-street/escalator', { platform })
    }
  }
})

router.get('/summary', async (req, res, next) => {
  if (filter(req, next)) {
    let query = querystring.parse(url.parse(req.url).query)
    query.exclude = (query.exclude || '').split(',').map(e => parseInt(e))

    let stationCode = req.headers.host.split('.')[0].toUpperCase()
    let stationName = stationCodes[stationCode].toLowerCase().replace(/ /g, '-')

    res.render('mockups/summary', {query, station: stationName, stationCode})
  }
})

router.post('/:platform/:type', async (req, res, next) => {
  if (filter(req, next)) {
    let departures = await getData(req, res)
    let isCityStop = cityStations.includes(req.params.station)

    res.json({ ...departures, isCityStop })
  }
})

module.exports = router
