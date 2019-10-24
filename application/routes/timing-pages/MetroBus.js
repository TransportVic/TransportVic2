const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-bus/get-departures')
const moment = require('moment')
const utils = require('../../../utils')

router.get('/:stopName', async (req, res) => {
  const stop = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stopName
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'metro bus')) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stopName + '. Are you sure buses stop there?')
  }

  let departures = await getDepartures(stop, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.actualDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      let minutesToDeparture = timeDifference.get('hours') * 60 + timeDifference.get('minutes')
      departure.prettyTimeToArrival = minutesToDeparture + ' m'
    }

    departure.headwayDevianceClass = 'unknown'
    if (departure.estimatedDepartureTime) {
      departure.headwayDeviance = departure.scheduledDepartureTime.diff(departure.estimatedDepartureTime, 'minutes')

      if (departure.headwayDeviance > 2) {
        departure.headwayDevianceClass = 'early'
      } else if (departure.headwayDeviance <= -5) {
        departure.headwayDevianceClass = 'late'
      } else {
        departure.headwayDevianceClass = 'on-time'
      }
    }
    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    departure.tripURL = `/metro-bus/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + utils.getYYYYMMDDNow()

    let destinationShortName = departure.trip.destination.split('/')[0]
    let {destination} = departure.trip
    if (!utils.isStreet(destinationShortName)) destination = destinationShortName
    departure.destination = destination.replace('Shopping Centre', 'SC')

    return departure
  })

  let services = []
  let groupedDepartures = {}

  departures.forEach(departure => {
    if (!services.includes(departure.routeNumber)) {
      services.push(departure.routeNumber)
      groupedDepartures[departure.routeNumber] = {}
    }
  })
  services.forEach(service => {
    let serviceDepartures = departures.filter(d => d.routeNumber === service)
    let serviceDestinations = []

    serviceDepartures.forEach(departure => {
      let {destination} = departure
      if (!serviceDestinations.includes(destination)) {
        serviceDestinations.push(destination)
        groupedDepartures[service][destination] =
          serviceDepartures.filter(d => d.destination === destination)
      }
    })
  })

  services = services.sort((a, b) => a - b)

  res.render('timings/metro-bus', { services, groupedDepartures, stop })
})

module.exports = router
