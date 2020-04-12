const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const utils = require('../../../utils')

router.get('/:stationName', async (req, res) => {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.filter(bay => bay.mode === 'metro train')) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stationName + '. Are you sure Metro trains stop there?')
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

    let destination = departure.destination || trip.destination.slice(0, -16)
    let origin = trip.origin.slice(0, -16)
    let originDepartureTime = trip.departureTime
    if (departure.forming) {
      origin = 'flinders-street'
      let flindersStreetTiming = departure.forming.stopTimings.find(stop => stop.stopName === 'Flinders Street Railway Station')
      originDepartureTime = flindersStreetTiming.departureTime
    }

    let stopGTFSID = departure.trip.stopTimings.filter(stop => stop.stopName === station.stopName)[0].stopGTFSID

    departure.tripURL = `${utils.encodeName(origin)}/${originDepartureTime}/`
      + `${utils.encodeName(destination)}/${trip.destinationArrivalTime}/`
      + `${utils.getYYYYMMDDNow()}/#stop-${stopGTFSID}`
    return departure
  })

  res.render('timings/metro-trains', { departures, station, placeholder: 'Destination or platform' })
})

module.exports = router
