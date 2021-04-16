const express = require('express')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const utils = require('../../../../utils')
const PIDBackend = require('../PIDBackend')
const stationDestinations = require('./station-destinations')

async function getData(req, res, options={}) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, '*', options, res.db)
}

router.get('/:station/up-down', async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/up-down', { now: utils.now() })
})

router.get('/:station/interchange', async (req, res) => {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/interchange', {
    now: utils.now(),
    stationName,
    destinations
  })
})


router.get('/:station/interchange/destinations', async (req, res) => {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []

  res.json(destinations)
})


router.post('/:station/up-down', async (req, res) => {
  let departures = await getData(req, res, {
    maxDepartures: Infinity
  })

  let rawDepartures = departures.dep.filter(departure => departure.p)
  let {d} = querystring.parse(url.parse(req.url).query)

  if (d) {
    return res.json({
      ...departures,
      dep: rawDepartures.filter(departure => {
        return departure.d.toLowerCase() === d[0]
      }).slice(0, 5)
    })
  } else {
    let up = rawDepartures.filter(departure => {
      return departure.d === 'U'
    }).slice(0, 4)

    let down = rawDepartures.filter(departure => {
      return departure.d === 'D'
    }).slice(0, 4)

    res.json({
      ...departures,
      dep: [...up, ...down]
    })
  }
})


router.post('/:station/interchange', async (req, res) => {
  let departures = await getData(req, res, {
    maxDepartures: Infinity,
    includeStopTimings: true
  })
  let groupedDepartures = {}

  departures.dep.filter(departure => {
    return departure.p
  }).forEach(departure => {
    let key = departure.route + departure.d
    if (!groupedDepartures[key]) groupedDepartures[key] = []
    groupedDepartures[key].push(departure)
  })

  res.json({
    stn: departures.dep[0] ? departures.dep[0].stops[0][0] : '',
    dep: Object.values(groupedDepartures).reduce((acc, group) => {
      return acc.concat(group.slice(0, 2))
    }, [])
  })
})

module.exports = router
