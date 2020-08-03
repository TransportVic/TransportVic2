const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const stationCodes = require('../../../additional-data/station-codes.json')
const rawStationPlatforms = require('../../../additional-data/station-platforms.json')
const rawStationPIDs = require('../../../additional-data/station-pids')
const url = require('url')
const querystring = require('querystring')

let stationPlatforms = {}
let stationPIDs = {}
let stationNames = {}

Object.keys(rawStationPlatforms).forEach(stationName => {
  stationPlatforms[utils.encodeName(stationName)] = rawStationPlatforms[stationName]
})

Object.keys(rawStationPIDs).forEach(stationName => {
  stationPIDs[utils.encodeName(stationName)] = rawStationPIDs[stationName]
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
  let {station} = req.params

  let stationPlatformData = stationPlatforms[station]
  let stationPID = stationPIDs[station]
  let stationCode = stationNames[station]

  if (stationPID.length) {
    res.render('mockups/summary-known', {stationPID, station, stationCode})
  } else {
    res.render('mockups/summary', {query, stationPlatformData, station, stationCode})
  }
})

let validConcourseTypes = ['up-down', 'interchange']

router.get('/get', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let query = querystring.parse(url.parse(req.url).query)
  let {type, value, station, concourseType} = query
  station = utils.encodeName(station || '')

  let errorMessage = `${type} is not a valid PID type`

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
  } else if (type === 'pre-platform-vertical') {
    return res.redirect(`/mockups/metro-lcd/${station}/${value}/pre-platform-vertical`)
  } else if (type === 'summary') {
    return res.redirect(`/mockups/summary/${station}?type=${value}`)
  } else if (type === 'concourse') {
    if (validConcourseTypes.includes(concourseType)) {
      return res.redirect(`/mockups/metro-lcd/concourse/${station}/${concourseType}`)
    } else {
      errorMessage = `${concourseType} is not a valid PID type`
    }
  } else if (type === 'bus-int-pids') {
    let {bay} = query
    let m = value.match(/\/bus\/timings(\/.+)/)
    if (m) {
      m = m[1]
      bay = bay || '*'
      return res.redirect('/mockups/bus-int-pids' + m + '/' + bay)
    } else {
      errorMessage = `${value} is an invalid bus stop`
    }
  }

  res.render('errors/400', {
    errorMessage
  })
})

module.exports = router
