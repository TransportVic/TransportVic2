import express from 'express'
import PIDRender from './PIDRenderer.mjs'
import { getPIDDepartures } from '../../../modules/pid/pid.mjs'
import utils from '../../../utils.js'

const router = new express.Router()

const PID_CONTROL = '/static/scripts/pid/test.mjs'
const SERVICE_LIST_CONTROL = '/static/scripts/pid/service-list.mjs'

router.get('/metro-lcd/full-pid', (req, res) => {
  new PIDRender(req, res).render('metro-lcd/full-pid-base', [ PID_CONTROL ])
})

router.get('/metro-lcd/half-platform', (req, res) => {
  new PIDRender(req, res).render('metro-lcd/half-platform', [ PID_CONTROL ])
})

router.get('/metro-lcd/half-platform-bold', (req, res) => {
  new PIDRender(req, res).render('metro-lcd/half-platform-bold', [ PID_CONTROL ])
})

router.get('/metro-lcd/service-list', (req, res) => {
  new PIDRender(req, res).render('metro-lcd/service-list-template', [ SERVICE_LIST_CONTROL ])
})

router.post('/data', async (req, res) => {
  const { station, platform } = req.body
  if (!station) res.end([])

  const departures = await getPIDDepartures(station, res.db)
  const now = utils.now()

  const relevantDepartures = (platform && platform !== '*') ? departures.filter(dep => dep.platform === platform) : departures

  res.send(relevantDepartures.map(departure => ({
    schTime: departure.scheduledDepartureTime.format('H:mma'),
    estTime: Math.round((departure.actualDepartureTime - now) / 1000 / 60),
    destination: departure.formingDestination || departure.destination,
    summary: departure.stoppingType,
    line: departure.cleanRouteName,
    platform: departure.platform,
    stops: departure.stops,
    disruptions: [],
    isArrival: departure.isArrival,
    direction: departure.direction
  })))
})

export default router
