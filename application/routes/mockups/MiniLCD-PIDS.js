const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get_departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

let northernGroup = [
  "Craigieburn",
  "Sunbury",
  "Upfield",
  "Werribee",
  "Williamstown",
  "Showgrounds/Flemington"
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station
  })

  let departures = (await getDepartures(station, res.db, 3, false, req.params.platform, 1))
    .filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')
      return minutesDifference < 180 && secondsDifference >= 10 // minutes round down
      return true
    })

  departures = await async.map(departures, async departure => {
    const timeDifference = departure.actualDepartureTime.diff(utils.now(), 'minutes')

    departure.minutesToDeparture = timeDifference

    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    let line = await res.db.getCollection('routes').findDocument({
      routeName: departure.trip.routeName,
      mode: 'metro train'
    })

    let lineStops = line.directions.filter(dir => dir.directionName !== 'City')[0].stops
      .map(stop => stop.stopName.slice(0, -16))

    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    let startingIndex = tripStops.indexOf(station.stopName.slice(0, -16))
    tripStops = tripStops.filter((_, i) => (i >= startingIndex))
    let viaCityLoop = tripStops.includes('Flagstaff')

    startingIndex = lineStops.indexOf(station.stopName.slice(0, -16))
    let endingIndex = lineStops.indexOf(departure.trip.destination)
    if (startingIndex > endingIndex) {
      lineStops.reverse()

      startingIndex = lineStops.indexOf(station.stopName.slice(0, -16))
      endingIndex = lineStops.indexOf(departure.trip.destination)
    }
    let tripPassesBy = lineStops.slice(startingIndex, endingIndex + 1)

    if (!viaCityLoop) {
      if (!northernGroup.includes(departure.trip.routeName))
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop))
      else
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop) || stop === 'Southern Cross')
    } else {
      if (northernGroup.includes(departure.trip.routeName))
        tripPassesBy = tripPassesBy.filter(stop => stop !== 'Southern Cross')
    }

    let screenStops = tripPassesBy.map(stop => {
      return {
        stopName: stop,
        isExpress: !tripStops.includes(stop)
      }
    })

    let expressCount = screenStops.filter(stop => stop.isExpress).length

    let additionalInfo = {
      screenStops, expressCount, viaCityLoop
    }

    departure.additionalInfo = additionalInfo
    if (departure.destination === 'North Melbourne')
      departure.destination = 'Nth Melbourne'

    return departure
  })

  return {departures, station}
}

router.get('/:station/:platform', async (req, res) => {
  let {departures, station} = await getData(req, res)

  res.render('mockups/pids/mini-lcd', { departures, platform: req.params.platform })
})

router.post('/:station/:platform', async (req, res) => {
  let {departures, station} = await getData(req, res)

  res.json({departures, platform: req.params.platform});
})

module.exports = router
