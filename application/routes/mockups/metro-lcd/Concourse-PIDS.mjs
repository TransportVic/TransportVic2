import express from 'express'
import url from 'url'
import querystring from 'querystring'
import utils from '../../../../utils.mjs'
import PIDBackend from '../PIDBackend.mjs'
import stationDestinations from './station-destinations.mjs'
import csrf from '../csrf.js'

const router = new express.Router()

async function getData(req, res, options={}) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, '*', options, res.db)
}

router.get('/:station/up-down', csrf, async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/up-down', {
    now: utils.now(),
    csrf: await req.csrfToken()
  })
})

router.get('/:station/interchange', csrf, async (req, res) => {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/interchange', {
    now: utils.now(),
    stationName,
    destinations,
    csrf: await req.csrfToken()
  })
})


router.get('/:station/interchange/destinations', csrf, async (req, res) => {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []

  res.json(destinations)
})


router.post('/:station/up-down', csrf, async (req, res) => {
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


router.post('/:station/interchange', csrf, async (req, res) => {
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

export default router