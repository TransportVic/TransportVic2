import express from 'express'
import PIDRender from './PIDRenderer.mjs'
import { getPIDDepartures } from '../../../modules/pid/pid.mjs'
import utils from '../../../utils.mjs'

const router = new express.Router()

const PID_CONTROL = '/static/scripts/pid/test.mjs'
const SERVICE_LIST_CONTROL = '/static/scripts/pid/service-list.mjs'

export const PID_DEFINITIONS = {
  '/metro-lcd/full-pid': {
    file: 'metro-lcd/full-pid-base',
    scripts: [ PID_CONTROL ]
  },
  '/metro-lcd/half-platform': {
    file: 'metro-lcd/half-platform',
    scripts: [ PID_CONTROL ]
  },
  '/metro-lcd/half-platform-bold': {
    file: 'metro-lcd/half-platform-bold',
    scripts: [ PID_CONTROL ]
  },
  '/metro-lcd/service-list': {
    file: 'metro-lcd/service-list-template',
    scripts: [ SERVICE_LIST_CONTROL ]
  },
  '/metro-lcd/platform-screen-door': {
    file: 'metro-lcd/platform-screen-door',
    scripts: [ PID_CONTROL ]
  }
}

for (const urlPath of Object.keys(PID_DEFINITIONS)) {
  const data = PID_DEFINITIONS[urlPath]
  router.get(urlPath, (req, res) => {
    new PIDRender(req, res).render(data.file, data.scripts)
  })
}

router.post('/data', async (req, res) => {
  const { station, platform } = req.body
  if (!station) res.end([])

  const departures = await getPIDDepartures(station, res.db)

  const now = utils.now()

  const relevantDepartures = (platform && platform !== '*') ? departures.filter(dep => dep.platform === platform) : departures

  res.send(relevantDepartures.map(departure => ({
    schTime: departure.scheduledDepartureTime.format('h:mma'),
    estTime: Math.round((departure.actualDepartureTime - now) / 1000 / 60),
    destination: departure.formingDestination || departure.destination,
    summary: departure.stoppingType,
    line: departure.cleanRouteName,
    platform: departure.platform,
    stops: departure.stops,
    disruptions: [],
    isArrival: departure.isArrival,
    direction: departure.direction,
    tunnelDirection: departure.tunnelDirection
  })))
})

export default router
