import express from 'express'
import stationCodes from '../../../additional-data/station-codes.json' with { type: 'json' }
import rawStationPIDs from '../../../additional-data/station-pids.js'
import utils from '../../../utils.mjs'
import PIDBackend from './PIDBackend.mjs'

const router = new express.Router()

function filter(req, next) {
  let host = req.headers.host || ''
  if (host.includes('pidsview')) return true
  else return void next()
}

let stationPIDs = {}

Object.keys(rawStationPIDs).forEach(stationName => {
  stationPIDs[utils.encodeName(stationName)] = rawStationPIDs[stationName]
})

router.get('/', async (req, res, next) => {
  if (filter(req, next)) {
    let stationCode = req.headers.host.split('.')[0].toUpperCase()
    if (req.headers.host.startsWith('pidsview.')) stationCode = 'FSS'
    if (stationCode === 'SSS') return res.render('mockups/sss-new/summary')

    let stationName = stationCodes[stationCode]
    if (!stationName) return res.render('mockups/summary-known', {stationPID: [], station: '', stationCode, getURL: PIDBackend.getURL})

    let codedStationName = utils.encodeName(stationName)
    let stationPID = stationPIDs[codedStationName]

    res.render('mockups/summary-known', {stationPID, station: codedStationName, stationCode, getURL: PIDBackend.getURL})
  }
})

router.use((req, res, next) => {
  if (filter(req, next)) {
    if (req.url.startsWith('/mockups/') || req.url.startsWith('/pid/')) {
      next()
    } else {
      next(new Error('404'))
    }
  }
})

export default router