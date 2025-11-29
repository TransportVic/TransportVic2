import express from 'express'
import PIDRender from './PIDRenderer.mjs'
import { getPIDDepartures } from '../../../modules/pid/pid.mjs'
import utils from '../../../utils.js'

const router = new express.Router()

router.get('/metro-lcd/full-pid', (req, res) => {
  new PIDRender(req, res).render('metro-lcd/full-pid-base', [
    '/static/scripts/pid/test.mjs'
  ])
})

router.post('/data', async (req, res) => {
  const { station, platform } = req.body
  if (!station) res.end([])

  const departures = await getPIDDepartures(station, res.db)
  const now = utils.now()

  const relevantDepartures = (platform && platform !== '*') ? departures.filter(dep => dep.platform === platform) : departures

  res.send(relevantDepartures.map(departure => ({
    schTime: departure.scheduledDepartureTime.format('HH:mma'),
    estTime: Math.round((departure.actualDepartureTime - now) / 1000 / 60),
    destination: departure.destination,
    summary: departure.stoppingType,
    line: departure.cleanRouteName,
    platform: departure.platform,
    stops: departure.stops,
    disruptions: [],
    isArrival: departure.isArrival
  })))
})

export default router
