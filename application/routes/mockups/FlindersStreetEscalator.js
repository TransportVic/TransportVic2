const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

const getLineStops = require('./route-stops')

let northernGroup = [
  "Craigieburn",
  "Sunbury",
  "Upfield",
  "Werribee",
  "Williamstown",
  "Showgrounds/Flemington"
]

let crossCityGroup = [
  "Werribee",
  "Williamstown",
  "Frankston"
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: (req.params.station || 'flinders-street') + '-railway-station'
  })

  let shouldFilterPlatform = req.params.platform !== '*'

  let vlineDepartures = [], metroDepartures = []
  try {
    vlineDepartures = (await getVLineDepartures(station, res.db))
      .map(departure => {
        departure.platform = departure.platform.replace('?', '')
        departure.type = 'vline'

        return departure
      }).filter(departure => {
        let mainPlatform = departure.platform.replace(/[A-Z]/, '')
        if (shouldFilterPlatform && mainPlatform !== req.params.platform) return false

        let diff = departure.actualDepartureTime
        let minutesDifference = diff.diff(utils.now(), 'minutes')
        let secondsDifference = diff.diff(utils.now(), 'seconds')

        return minutesDifference < 120 && secondsDifference >= 10 // minutes round down
      })
  } catch (e) {}

  try {
    metroDepartures = (await getDepartures(station, res.db, 15, true))
    .filter(departure => {
      if (departure.cancelled) return false

      if (shouldFilterPlatform && departure.platform !== req.params.platform) return false


      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')
      return minutesDifference < 120 && secondsDifference >= 10 // minutes round down
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

    let {routeGTFSID} = departure.trip

    // let line = await res.db.getCollection('routes').findDocument({
    //   routeGTFSID
    // })

    // let lineStops = line.directions.find(dir => {
    //   if (routeGTFSID === '5-V27') { // maryborough run as shuttles to ballarat
    //     return dir.directionName !== 'Ballarat Railway Station'
    //   }
    //   return dir.directionName !== 'City' && dir.directionName !== 'Southern Cross Railway Station'
    // }).stops.map(stop => stop.stopName.slice(0, -16))


    let lineStops = getLineStops(departure.trip.shortRouteName || departure.trip.routeName)
    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    if (departure.forming) {
      let prevTripCityLoop = tripStops.filter(e => cityLoopStations.includes(e))
      tripStops = [...prevTripCityLoop, ...departure.forming.stopTimings.map(stop => stop.stopName.slice(0, -16))]
      tripStops = tripStops.filter((e, i, a) => a.indexOf(e) === i)

      lineStops = getLineStops(departure.forming.shortRouteName || departure.forming.routeName)
    }

    lineStops = lineStops.slice(0)

    // If there's a forming then consider it as a down trip
    let isFormingNewTrip = !!departure.forming
    let isUp = departure.trip.direction === 'Up' && !isFormingNewTrip
    let destination = isFormingNewTrip ? departure.destination : departure.trip.destination

    if (isUp) {
      lineStops = lineStops.reverse()

      let hasSeenFSS = false
      tripStops = tripStops.filter(e => {
        if (hasSeenFSS) return false
        if (e === 'Flinders Street') {
          hasSeenFSS = true
        }
        return true
      })
    }

    let stationName = station.stopName.slice(0, -16)
    let relevantTrip = departure.forming || departure.trip
    let routeName = relevantTrip.shortRouteName || relevantTrip.routeName

    let startingIndex = tripStops.indexOf(stationName)
    let viaCityLoop = tripStops.includes('Flagstaff')
    tripStops = tripStops.slice(startingIndex)

    if (viaCityLoop) {
      let cityLoopStops = tripStops.filter(e => cityLoopStations.includes(e))
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))

      if (isUp) {
        lineStops = lineStops.slice(0, -1).concat(cityLoopStops)
        lineStops.push('Flinders Street')
      } else {
        lineStops = ['Flinders Street', ...cityLoopStops, ...lineStops.slice(1)]
      }
    } else if (departure.type === 'vline') {
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))
      lineStops = ['Southern Cross', ...lineStops]
    } else {
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))

      if (northernGroup.includes(routeName)) {
        if (isUp) {
          lineStops = [...lineStops.slice(0, -1), 'Southern Cross', 'Flinders Street']
        } else {
          lineStops = ['Flinders Street', 'Southern Cross', ...lineStops.slice(1)]
        }
      } else if (routeName === 'Frankston') {
        if (isUp) {
          lineStops = [...lineStops.slice(0, -1), 'Flinders Street', 'Southern Cross']
        } else {
          lineStops = ['Southern Cross', 'Flinders Street', ...lineStops.slice(1)]
        }
      }
    }

    startingIndex = lineStops.indexOf(stationName)
    let endingIndex = lineStops.indexOf(destination)

    let tripPassesBy = lineStops.slice(startingIndex, endingIndex + 1)

    if (viaCityLoop) {
      if (northernGroup.includes(routeName)) {
        if (isFormingNewTrip && stationName === 'Southern Cross') {
          tripPassesBy = [
            'Southern Cross', 'Flinders Street', ...tripPassesBy.slice(1)
          ]
        } else {
          tripPassesBy = tripPassesBy.filter(stop => stop !== 'Southern Cross')
        }
      }
    } else {
      if (northernGroup.includes(routeName)) {
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop) || stop === 'Southern Cross')
      } else if (departure.type !== 'vline') {
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop))
      }

      if (crossCityGroup.includes(relevantTrip.routeName) && isFormingNewTrip && stationName === 'Southern Cross') {
        tripPassesBy = ['Southern Cross', ...tripPassesBy]
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
      screenStops, expressCount, viaCityLoop, direction: isUp ? 'Up': 'Down'
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
