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
  "2-WMN"
]

router.get('/:platform', async (req, res) => {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: 'flinders-street'
  })

  if (!station) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stationName + '. Are you sure Metro trains stop there?')
  }

  let departures = (await getDepartures(station, res.db, 5, false, req.params.platform))
    .filter(departure => {
      let minutesDifference = (departure.estimatedDepartureTime || departure.scheduledDepartureTime).diff(utils.now(), 'minutes')
      // return minutesDifference < 180
      return true
    })

  departures = await async.map(departures, async departure => {
    const timeDifference = (departure.estimatedDepartureTime || departure.scheduledDepartureTime).diff(utils.now(), 'minutes')

    if (+timeDifference <= 0) departure.prettyTimeToDeparture = 'Now'
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
    let viaCityLoop = tripStops.includes('Flagstaff');

    let startingIndex = lineStops.indexOf(departure.trip.origin.slice(0, -16))
    let endingIndex = lineStops.indexOf(departure.trip.destination.slice(0, -16))

    let tripPassesBy = lineStops.filter((_, i) => (i >= startingIndex) && (i <= endingIndex))
    if (!viaCityLoop) {
      if (!northernGroup.includes(departure.trip.routeGTFSID))
        tripPassesBy.splice(1, 4)
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

  if (!departures.length) return res.end('no departure need to do that screen')

  res.render('mockups/flinders-street/escalator', { departures })
})

module.exports = router
