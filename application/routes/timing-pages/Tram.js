const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/tram/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const tramDestinations = require('../../../modules/tram/tram-destinations')

router.get('/:suburb/:stopName', async (req, res) => {
  const stop = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'tram')) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stopName + '. Are you sure trams stop there?')
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

    let stopGTFSID = departure.trip.stopTimings.filter(tripStop => tripStop.stopName.includes(stop.stopName))[0].stopGTFSID

    departure.tripURL = `/tram/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${utils.getYYYYMMDDNow()}/#stop-${stopGTFSID}`

    let destinationShortName = departure.trip.destination.split('/')[0]
    let {destination} = departure.trip
    if (!utils.isStreet(destinationShortName)) destination = destinationShortName
    departure.destination = tramDestinations[destination] || destination

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

  //todo check 3a
  res.render('timings/grouped', {
    services, groupedDepartures, stop,
    classGen: departure => `tram-${departure.routeNumber}`
  })
})

module.exports = router
