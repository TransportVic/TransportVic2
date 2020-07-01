const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const stationCodes = require('../../../additional-data/station-codes.json')
const rawStationPlatforms = require('../../../additional-data/station-platforms.json')
const url = require('url')
const querystring = require('querystring')

let stationPlatforms = {}
let stationNames = {}

Object.keys(rawStationPlatforms).forEach(stationName => {
  stationPlatforms[utils.encodeName(stationName)] = rawStationPlatforms[stationName]
})

Object.keys(stationCodes).forEach(stationCode => {
  let name = utils.encodeName(stationCodes[stationCode])
  stationNames[name] = stationCode
})


router.get('/', (req, res) => {
  res.render('mockups/index')
})

router.get('/summary/:station', (req, res) => {
  let query = querystring.parse(url.parse(req.url).query)
  let stationPlatformData = stationPlatforms[req.params.station]
  let stationCode = stationNames[req.params.station]

  res.render('mockups/summary', {query, stationPlatformData, station: req.params.station, stationCode})
})

router.get('/get', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let query = querystring.parse(url.parse(req.url).query)
  let {type, value, station} = query
  station = utils.encodeName(station || '')

  if (type === 'fss-escalator') {
    return res.redirect('/mockups/fss/escalator/' + value + (station ? '/' + station : ''))
  } else if (type === 'fss-platform') {
    return res.redirect('/mockups/fss/platform/' + value + (station ? '/' + station : ''))
  } else if (type === 'half-platform') {
    return res.redirect(`/mockups/metro-lcd/${station}/${value}/half-platform`)
  } else if (type === 'half-platform-bold') {
    return res.redirect(`/mockups/metro-lcd/${station}/${value}/half-platform-bold`)
  } else if (type === 'platform') {
    return res.redirect(`/mockups/metro-lcd/${station}/${value}/platform`)
  } else if (type === 'summary') {
    return res.redirect(`/mockups/summary/${station}?type=${value}`)
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
