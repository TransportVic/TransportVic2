 import express from 'express'
import utils from '../../../../utils.mjs'
import PIDBackend from '../PIDBackend.mjs'
import csrf from '../csrf.js'

const router = new express.Router()

let validPIDTypes = ['half-platform-bold', 'half-platform', 'platform', 'pre-platform-vertical']

async function getData(req, res) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, req.params.platform, {}, res.db)
}

router.get('/:station/:platform/:type', csrf, async (req, res, next) => {
  let pidType = req.params.type
  if (!validPIDTypes.includes(pidType)) return next()

  if (pidType === 'pre-platform-vertical') {
    res.render('mockups/fss/escalator', {
      platform: req.params.platform, dark: true,
      csrf: await req.csrfToken()
     })
  } else {
    res.render('mockups/metro-lcd/' + pidType, {
      platform: req.params.platform,
      now: utils.now(),
      csrf: await req.csrfToken()
    })
  }
  
  getData(req, res)
})

router.post('/:station/:platform/:type', csrf, async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

export default router