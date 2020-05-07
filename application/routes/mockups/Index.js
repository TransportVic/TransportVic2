const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const rawStationPlatforms = require('../../../additional-data/station-platforms.json')
const url = require('url')
const querystring = require('querystring')

let stationPlatforms = {}
Object.keys(rawStationPlatforms).forEach(stationName => {
  stationPlatforms[utils.encodeName(stationName)] = rawStationPlatforms[stationName]
})


router.get('/', (req, res) => {
  res.render('mockups/index')
})

router.get('/summary/:station', (req, res) => {
  let query = querystring.parse(url.parse(req.url).query)
  let stationPlatformData = stationPlatforms[req.params.station]

  res.render('mockups/summary', {query, stationPlatformData, station: req.params.station})
})

router.get('/sss-summary/', (req, res) => {
  res.render('mockups/sss-summary')
})

router.get('/get', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let query = querystring.parse(url.parse(req.url).query)
  let {type, value} = query
  if (type === 'fss-escalator') {
    return res.redirect('/mockups/fss-escalator/' + value)
  } else if (type === 'bus-int-pids') {
    let {bay} = query
    let m = value.match(/\/bus\/timings(\/.+)/)
    if (m) {
      m = m[1]
      bay = bay || '*'
      res.redirect('/mockups/bus-int-pids' + m + '/' + bay)
    }
  }
  res.end('what?')
})

module.exports = router
