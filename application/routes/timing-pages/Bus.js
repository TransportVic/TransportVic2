const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/bus/get-departures')
const busDestinations = require('../../../additional-data/bus-destinations')
const moment = require('moment')
const utils = require('../../../utils')
const async = require('async')

router.get('/:suburb/:stopName', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'bus')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(stop, res.db)

  departures = await async.map(departures, async departure => {
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

    departure.tripURL = `/bus/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${day}#stop-${departure.trip.stopTimings[0].stopGTFSID}`

    let fullDestination = departure.trip.destination
    let destinationShortName = departure.trip.destination.split('/')[0]
    let {destination} = departure.trip
    if (!utils.isStreet(destinationShortName)) destination = destinationShortName
    departure.destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

    let serviceData = busDestinations.service[departure.routeNumber] || busDestinations.service[departure.trip.routeGTFSID] || {}
    departure.destination = serviceData[departure.destination]
      || busDestinations.generic[departure.destination]
      || busDestinations.generic[fullDestination] || departure.destination

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/bus/timings/${destinationStop.codedSuburb[0]}/${destinationStop.codedName}`

    return departure
  })

  let services = []
  let groupedDepartures = {}

  departures.forEach(departure => {
    if (!services.includes(departure.sortNumber)) {
      services.push(departure.sortNumber)
      groupedDepartures[departure.sortNumber] = {}
    }
  })
  services.forEach(service => {
    let serviceDepartures = departures.filter(d => d.sortNumber === service)
    let serviceDestinations = []

    serviceDepartures.forEach(departure => {
      let destination = departure.destination + departure.viaText + departure.loopDirection
      if (!serviceDestinations.includes(destination)) {
        serviceDestinations.push(destination)
        groupedDepartures[service][destination] =
          serviceDepartures.filter(d => d.destination + d.viaText + d.loopDirection === destination)
          .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
      }
    })
  })

  services = services.sort((a, b) => a - b)

  res.render('timings/grouped', {
    services, groupedDepartures, stop,
    classGen: departure => {
      let operator = departure.codedOperator
      if (operator.startsWith('dysons')) return 'dysons'
      return operator
    },
    currentMode: 'bus'
  })
})

module.exports = router
