import express from 'express'
import utils from '../../../../utils.mjs'
import PIDBackend from '../PIDBackend.mjs'
import csrf from '../csrf.js'

const router = new express.Router()

let validPIDTypes = ['escalator', 'platform']
let cityLoopConfigStops = ['Flinders Street', 'Parliament', 'Melbourne Central', 'Flagstaff', 'Southern Cross', 'North Melbourne', 'Jolimont', 'Richmond']

async function getData(req, res, options={}) {
  let station = await PIDBackend.getStation(req.params.station || 'flinders-street', res.db)

  return await PIDBackend.getPIDData(station, req.params.platform, options, res.db)
}


router.get('/:type/:platform/{:station}', csrf, async (req, res, next) => {
  let pidType = req.params.type
  if (!validPIDTypes.includes(pidType)) return next()
  getData(req, res)

  res.render('mockups/fss/' + pidType, {
    platform: req.params.platform,
    now: utils.now(),
    csrf: await req.csrfToken()
  })
})


router.post('/:type/:platform/{:station}', csrf, async (req, res) => {
  res.json(await getData(req, res))
})

router.get('/trains-from-fss', csrf, async (req, res) => {
  res.render('mockups/fss/trains-from-fss', {
    now: utils.now(),
    csrf: await req.csrfToken()
  })
})

router.post('/trains-from-fss', csrf, async (req, res) => {
  let departures = await getData({ params: {
    platform: '*'
  } }, res, {
    maxDepartures: Infinity,
    includeStopTimings: true
  })

  let groupedDepartures = {}
  let now = new Date()

  departures.dep.filter(departure => {
    let departureTime = departure.est || departure.sch
    return departure.p && (departureTime - now) > 1000 * 60
  }).forEach(departure => {
    let cityLoopConfig = departure.times.filter(stop => cityLoopConfigStops.includes(stop.name))
    if (cityLoopConfig[cityLoopConfig.length - 1] === 'Flinders Street') cityLoopConfig.pop() // Account for CCL

    let key = cityLoopConfig.join(',')

    if (!groupedDepartures[key]) groupedDepartures[key] = []
    groupedDepartures[key].push(departure)

    departure.stops = []
    departure.times = departure.times.slice(0, 6)
  })

  departures.dep = Object.values(groupedDepartures).reduce((acc, group) => {
    return acc.concat(group.slice(0, 2))
  }, [])

  res.json(departures)
})

export default router