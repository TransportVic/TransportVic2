const express = require('express')
const router = new express.Router()
const async = require('async')

const TrainUtils = require('./TrainUtils')
const getLineStops = require('./route-stops')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: (req.params.station || 'flinders-street') + '-railway-station'
  })

  let departures = await TrainUtils.getCombinedDepartures(station, res.db)
  departures = departures.filter(d => d.platform !== 'RRB')
  departures = TrainUtils.filterPlatforms(departures, req.params.platform)

  let lineGroups = departures.map(departure => departure.trip.routeName)
    .filter((e, i, a) => a.indexOf(e) === i)
  let groupedDepartures = lineGroups.reduce((acc, group) => {
    acc[group] = departures.filter(departure => departure.trip.routeName === group).slice(0, 3)
    return acc
  }, {})
  departures = Object.values(groupedDepartures).reduce((acc, group) => {
    return acc.concat(group)
  }, []).sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime
  })

  departures = departures.map(departure => {
    return TrainUtils.appendScreenDataToDeparture(departure, station)
  })
  departures = departures.filter(Boolean)

  return {departures, station}
}

router.get('/:platform/:station*?', async (req, res) => {
  let {departures, station} = await getData(req, res)
  let stationName = station.stopName.slice(0, -16)
  let isCityStop = cityLoopStations.includes(stationName) || stationName === 'Flinders Street'

  res.render('mockups/flinders-street/escalator', { departures, platform: req.params.platform, isCityStop })
})

router.post('/:platform/:station*?', async (req, res) => {
  let {departures, station} = await getData(req, res)
  let stationName = station.stopName.slice(0, -16)
  let isCityStop = cityLoopStations.includes(stationName) || stationName === 'Flinders Street'

  res.json({departures, platform: req.params.platform, isCityStop})
})

module.exports = router
