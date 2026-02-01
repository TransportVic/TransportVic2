import express from 'express'
import utils from '../../../utils.mjs'
import stationCodes from '../../../additional-data/station-codes.json' with { type: 'json' }
import rawStationPlatforms from '../../../additional-data/station-platforms.json' with { type: 'json' }
import rawStationPIDs from '../../../additional-data/station-pids.js'
import url from 'url'
import querystring from 'querystring'
import PIDBackend from './PIDBackend.mjs'
import busBays from '../../../additional-data/bus-data/bus-bays.mjs'

const router = new express.Router()

async function preloadData(db, station, platform) {
  PIDBackend.getPIDData(await PIDBackend.getStation(station, db), platform, {}, db)
}

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

  if (station === 'southern-cross') return res.redirect('/mockups/sss-new')

  let stationPlatformData = stationPlatforms[station]
  let stationPID = stationPIDs[station]
  let stationCode = stationNames[station]
  if (!stationCode) {
    return res.render('mockups/summary-known', {stationPID: [], station, stationCode: '', getURL: ''})
  }
  preloadData(res.db, station, '*')

  if (stationPID.length && !query.type) {
    res.render('mockups/summary-known', {stationPID, station, stationCode, getURL: PIDBackend.getURL})
  } else {
    res.render('mockups/summary', {query, stationPlatformData, station, stationCode, getURL: PIDBackend.getURL})
  }
})

router.get('/station-preview/:station', (req, res) => {
  let {station} = req.params

  let stationPlatformData = stationPlatforms[station]
  let stationPID = stationPIDs[station]
  let stationCode = stationNames[station]

  if (stationPID.length) {
    let pid = stationPID.filter(p => p.platform).sort((a, b) => a.platform - b.platform)[0]
    res.redirect(PIDBackend.getURL(station, pid))
  } else {
    res.redirect(`/mockups/metro-lcd/${station}/1/half-platform`)
  }
})

let validConcourseTypes = ['up-down', 'interchange']

router.get('/get', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let query = querystring.parse(url.parse(req.url).query)
  let {type, value, station, concourseType} = query
  station = utils.encodeName(station || '')

  let errorMessage = `${type} is not a valid PID type`

  if (type === 'concourse') {
    if (validConcourseTypes.includes(concourseType)) {
      return res.redirect(`/mockups/metro-lcd/concourse/${station}/${concourseType}`)
    } else {
      errorMessage = `${concourseType} is not a valid PID type`
    }
  } else if (type === 'bus-int-pids') {
    let {bay} = query
    let m
    if (m = value.match(/\/bus\/timings(\/.+)/)) {
      m = m[1]
      bay = bay || '*'
      return res.redirect('/mockups/bus-int-pids/half' + m + '/' + bay)
    } else if (m = value.match(/^\d+$/)) {
      const stop = await stops.findDocument({
        bays: {
          $elemMatch: {
            stopGTFSID: value,
            mode: 'bus'
          }
        }
      })

      if (stop) {
        const bay = stop.bays.find(bay => bay.mode === 'bus' && bay.stopGTFSID === value)
        const bayNumber = busBays[bay.stopGTFSID] ? busBays[bay.stopGTFSID].slice(4) : '*'
        return res.redirect(`/mockups/bus-int-pids/half/${stop.cleanSuburbs[0]}/${stop.cleanNames[0]}/${bayNumber}`)
      }
    }

    errorMessage = `${value} is an invalid bus stop`
  } else if (type === 'summary') {
    const nameFromCode = utils.encodeName(stationCodes[station.toUpperCase()] || '')
    return res.redirect(`/mockups/summary/${nameFromCode || station}?type=${value}`)
  } else {
    let url = PIDBackend.getURL(station, {
      type,
      platform: value
    })

    if (url) return res.redirect(url)
  }

  res.render('errors/400', {
    errorMessage
  })
})

export default router