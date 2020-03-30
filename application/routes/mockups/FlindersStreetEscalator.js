const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
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
    codedName: (req.params.station || 'flinders-street') + '-railway-station'
  })

  let vlineDepartures = [], metroDepartures = []
  try {
    vlineDepartures = (await getVLineDepartures(station, res.db))
      .map(departure => {
        departure.platform = departure.platform.replace('?', '')
        departure.type = 'vline'

        return departure
      }).filter(departure => {
        if (departure.platform !== req.params.platform) return false

        let diff = departure.actualDepartureTime
        let minutesDifference = diff.diff(utils.now(), 'minutes')
        let secondsDifference = diff.diff(utils.now(), 'seconds')

        return minutesDifference < 180 && secondsDifference >= 10 // minutes round down
      })
  } catch (e) {}

  try {
    metroDepartures = (await getDepartures(station, res.db, 6, false, req.params.platform, 1))
    .filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')
      return minutesDifference < 180 && secondsDifference >= 10 // minutes round down
    })
  } catch (e) {}

  let departures = metroDepartures.concat(vlineDepartures)

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

  departures = await async.map(departures, async departure => {
    const timeDifference = departure.actualDepartureTime.diff(utils.now(), 'minutes')

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
    if (departure.trip.direction === 'Up') {
      let hasSeenFSS = false
      tripStops = tripStops.filter(e => {
        if (hasSeenFSS) return false
        if (e === 'Flinders Street') {
          hasSeenFSS = true
        }
        return true
      })
    }

    let startingIndex = tripStops.indexOf(station.stopName.slice(0, -16))
    let viaCityLoop = tripStops.includes('Flagstaff')
    tripStops = tripStops.filter((_, i) => (i >= startingIndex))

    if (viaCityLoop) {
      let cityLoopStops = tripStops.filter(e => cityLoopStations.includes(e))
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))

      if (departure.trip.direction === 'Up') {
        lineStops = lineStops.slice(0, -1).concat(cityLoopStops)
        lineStops.push('Flinders Street')
      } else {
        lineStops = ['Flinders Street', ...cityLoopStops, ...lineStops.slice(1)]
      }
    }

    startingIndex = lineStops.indexOf(station.stopName.slice(0, -16))
    let endingIndex = lineStops.indexOf(departure.trip.destination)
    if (startingIndex > endingIndex) {
      lineStops.reverse()

      startingIndex = lineStops.indexOf(station.stopName.slice(0, -16))
      endingIndex = lineStops.indexOf(departure.trip.destination)
    }
    let tripPassesBy = lineStops.slice(startingIndex, endingIndex + 1)

    if (!viaCityLoop && departure.type !== 'vline') {
      if (!northernGroup.includes(departure.trip.routeName)) {
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop))
      } else {
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop) || stop === 'Southern Cross')
      }
    } else {
      if (northernGroup.includes(departure.trip.routeName)) {
        tripPassesBy = tripPassesBy.filter(stop => stop !== 'Southern Cross')
      }
    }
    let screenStops = tripPassesBy.map(stop => {
      return {
        stopName: stop,
        isExpress: !tripStops.includes(stop)
      }
    })

    if (!screenStops.length) return null
    let expressCount = screenStops.filter(stop => stop.isExpress).length

    let additionalInfo = {
      screenStops, expressCount, viaCityLoop, direction: departure.trip.direction
    }

    departure.additionalInfo = additionalInfo

    return departure
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
