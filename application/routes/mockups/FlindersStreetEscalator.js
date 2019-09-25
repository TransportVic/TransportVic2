const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get_departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

let northernGroup = [
  "2-B31", // craigieburn
  "2-SYM",
  "2-UFD",
  "2-WBE",
  "2-WMN",
  "2-ain" // showgrounds
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station || 'flinders-street'
  })

  let departures = (await getDepartures(station, res.db, 6, false, req.params.platform))
    .filter(departure => {
      let diff = (departure.estimatedDepartureTime || departure.scheduledDepartureTime)
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')
      return minutesDifference < 180 && secondsDifference >= 30
      return true
    })

  departures = await async.map(departures, async departure => {
    const timeDifference = (departure.estimatedDepartureTime || departure.scheduledDepartureTime).diff(utils.now(), 'minutes')

    if (+timeDifference <= 0) departure.prettyTimeToDeparture = 'NOW'
    else {
      departure.prettyTimeToDeparture = timeDifference + ' min'
    }

    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    let line = await res.db.getCollection('routes').findDocument({
      routeGTFSID: departure.trip.routeGTFSID
    })

    let lineStops = line.directions.filter(dir => dir.directionName !== 'City')[0].stops
      .map(stop => stop.stopName.slice(0, -16))

    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    let startingIndex = tripStops.indexOf(station.stopName.slice(0, -16))
    tripStops = tripStops.filter((_, i) => (i >= startingIndex))
    let viaCityLoop = tripStops.includes('Flagstaff')

    startingIndex = lineStops.indexOf(station.stopName.slice(0, -16))
    let endingIndex = lineStops.indexOf(departure.trip.destination.slice(0, -16))
    if (startingIndex > endingIndex) {
      lineStops.reverse()

      startingIndex = lineStops.indexOf(station.stopName.slice(0, -16))
      endingIndex = lineStops.indexOf(departure.trip.destination.slice(0, -16))
    }
    let tripPassesBy = lineStops.filter((_, i) => (i >= startingIndex) && (i <= endingIndex))

    if (!viaCityLoop) {
      if (!northernGroup.includes(departure.trip.routeGTFSID))
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop))
      else
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop) || stop === 'Southern Cross')
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

    return departure
  })

  return {departures, station}
}

router.get('/:platform/:station*?', async (req, res) => {
  let {departures, station} = await getData(req, res)

  if (!departures.length) return res.end('no departure need to do that screen')
  res.render('mockups/flinders-street/escalator', { departures, bodyOnly: false })
})

router.post('/:platform/:station*?', async (req, res) => {
  let {departures, station} = await getData(req, res)

  res.json({departures});
})

module.exports = router
