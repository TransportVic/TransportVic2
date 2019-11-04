const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/bus/get-departures')
const busDestinations = require('../../../modules/bus/bus-destinations')
const moment = require('moment')
const utils = require('../../../utils')

router.get('/:suburb/:stopName', async (req, res) => {
  const stop = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'bus')) {
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

    let day = utils.getYYYYMMDD(departure.scheduledDepartureTime)
    if (departure.isNightBus && departure.scheduledDepartureTime.get('minutes') < 180)
      day = utils.getYYYYMMDD(departure.scheduledDepartureTime.clone().add(1, 'day'))

    departure.tripURL = `/bus/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${day}#stop-${departure.trip.stopTimings[0].stopGTFSID}`

    let destinationShortName = departure.trip.destination.split('/')[0]
    let {destination} = departure.trip
    if (!utils.isStreet(destinationShortName)) destination = destinationShortName
    departure.destination = destination.replace('Shopping Centre', 'SC')

    let serviceData = busDestinations.service[departure.routeNumber] || {}
    departure.destination = serviceData[departure.destination]
      || busDestinations.generic[departure.destination] || departure.destination

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
      let destination = departure.destination + departure.viaText
      if (!serviceDestinations.includes(destination)) {
        serviceDestinations.push(destination)
        groupedDepartures[service][destination] =
          serviceDepartures.filter(d => d.destination === departure.destination)
      }
    })
  })

  services = services.sort((a, b) => a - b)

  res.render('timings/grouped', {
    services, groupedDepartures, stop,
    classGen: departure => departure.codedOperator
  })
})

module.exports = router
