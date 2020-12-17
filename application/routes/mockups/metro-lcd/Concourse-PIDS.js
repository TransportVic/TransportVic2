const express = require('express')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const utils = require('../../../../utils')
const TrainUtils = require('../TrainUtils')
const PIDUtils = require('../PIDUtils')
const stationDestinations = require('./station-destinations')

async function getData(req, res) {
  let station = await PIDUtils.getStation(res.db, req.params.station)

  return await TrainUtils.getPIDSDepartures(res.db, station, '*', null, null, Infinity, true)
}

router.get('/:station/up-down', async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-lcd/concourse/up-down', { now: utils.now() })
})

router.get('/:station/interchange', async (req, res) => {
  let station = await PIDUtils.getStation(res.db, req.params.station)

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
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let stationName = station ? station.stopName.slice(0, -16) : '??'
  let destinations = stationDestinations[stationName] || []

  res.json(destinations)
})


router.post('/:station/up-down', async (req, res) => {
  let departures = await getData(req, res)

  let {d} = querystring.parse(url.parse(req.url).query)
  if (d) {
    return res.json({
      ...departures,
      departures: departures.departures.filter(departure => {
        return departure.direction.toLowerCase() === d
      }).slice(0, 5)
    })
  } else {
    let up = departures.departures.filter(departure => {
      return departure.direction === 'Up'
    }).slice(0, 4)

    let down = departures.departures.filter(departure => {
      return departure.direction === 'Down'
    }).slice(0, 4)

    res.json({
      ...departures,
      departures: [...up, ...down]
    })
  }
})


router.post('/:station/interchange', async (req, res) => {
  let departures = await getData(req, res)
  let groupedDepartures = {}

  departures.departures.forEach(departure => {
    let key = departure.routeName + departure.direction
    if (!groupedDepartures[key]) groupedDepartures[key] = []
    groupedDepartures[key].push(departure)
  })

  res.json({
    ...departures,
    departures: Object.values(groupedDepartures).reduce((acc, group) => {
      return acc.concat(group.slice(0, 3))
    }, [])
  })
})

module.exports = router
