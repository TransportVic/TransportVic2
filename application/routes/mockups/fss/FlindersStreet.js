const express = require('express')
const router = new express.Router()
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')
const PIDUtils = require('../PIDUtils')

let validPIDTypes = ['escalator', 'platform']
let cityLoopConfigStops = ['Flinders Street', 'Parliament', 'Melbourne Central', 'Flagstaff', 'Southern Cross', 'North Melbourne', 'Jolimont', 'Richmond']

async function getData(req, res, addStopTimings=false) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, null, null, req.params.maxDepartures || 5, addStopTimings)
}

router.get('/:type/:platform/:station*?', async (req, res, next) => {
  let pidType = req.params.type
  if (!validPIDTypes.includes(pidType)) return next()
  setTimeout(async () => await getData(req, res), 0)

  res.render('mockups/fss/' + pidType, { platform: req.params.platform, now: utils.now() })
})

router.post('/:type/:platform/:station*?', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

router.get('/trains-from-fss', async (req, res) => {
  res.render('mockups/fss/trains-from-fss', { now: utils.now() })
})

router.post('/trains-from-fss', async (req, res) => {
  let departures = await getData({ params: { platform: '*', maxDepartures: Infinity } }, res, true)
  let groupedDepartures = {}

  departures.departures.forEach(departure => {
    let cityLoopConfig = departure.stopTimings.map(stop => stop.stopName).filter(stop => cityLoopConfigStops.includes(stop))
    if (cityLoopConfig.slice(-1)[0] === 'Flinders Street') cityLoopConfig.pop() // Account for CCL

    let key = cityLoopConfig.join(',')
    if (!groupedDepartures[key]) groupedDepartures[key] = []
    groupedDepartures[key].push(departure)
  })

  departures.departures = Object.values(groupedDepartures).reduce((acc, group) => {
    return acc.concat(group.slice(0, 3))
  }, [])

  res.json(departures)
})

module.exports = router
