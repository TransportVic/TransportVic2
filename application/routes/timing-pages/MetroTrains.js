const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const utils = require('../../../utils')

async function loadDepartures(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.filter(bay => bay.mode === 'metro train')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(station, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.actualDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }

    departure.headwayDevianceClass = 'unknown'
    if (departure.estimatedDepartureTime) {
      departure.headwayDeviance = departure.scheduledDepartureTime.diff(departure.estimatedDepartureTime, 'minutes')

      // trains cannot be early
      let lateThreshold = 5
      if (departure.headwayDeviance <= -lateThreshold) { // <= 5min counts as late
        departure.headwayDevianceClass = 'late'
      } else {
        departure.headwayDevianceClass = 'on-time'
      }
    }

    let trip = departure.forming || departure.trip

    departure.codedLineName = utils.encodeName(trip.routeName)

    let tripToUse = departure.forming || trip

    let origin = tripToUse.trueOrigin.slice(0, -16)
    let originDepartureTime = tripToUse.trueDepartureTime
    let destination = tripToUse.trueDestination.slice(0, -16)
    let destinationArrivalTime = tripToUse.trueDestinationArrivalTime

    let stopGTFSID = departure.trip.stopTimings.filter(stop => stop.stopName === station.stopName)[0].stopGTFSID

    departure.tripURL = `${utils.encodeName(origin)}/${originDepartureTime}/`
      + `${utils.encodeName(destination)}/${destinationArrivalTime}/`
      + `${utils.getYYYYMMDDNow()}/#stop-${stopGTFSID}`

    departure.destinationURL = `/metro/timings/${utils.encodeName(departure.trip.trueDestination).slice(0, -16)}`

    return departure
  })

  return {
    departures,
    station,
    placeholder: 'Destination or platform'
  }
}

router.get('/:stationName', async (req, res) => {
  res.render('timings/metro-trains', await loadDepartures(req, res))
})

router.post('/:stationName', async (req, res) => {
  res.render('timings/templates/metro-trains', await loadDepartures(req, res))
})

module.exports = router
