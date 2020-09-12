const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/tram/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const tramDestinations = require('../../../additional-data/tram-destinations')
const async = require('async')

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.find(bay => bay.mode === 'tram')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(stop, res.db)
  let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

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

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    if (departure.trip.stopTimings[0].departureTimeMinutes > 1440) tripStart.add(-1, 'day') // edge case where trip starts after midnight and recorded as 25:00 on

    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/tram/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}/#stop-${stopGTFSID}`

    let destinationShortName = utils.getStopName(departure.trip.destination)
    let {destination} = departure.trip
    if (!utils.isStreet(destinationShortName)) destination = destinationShortName
    departure.destination = tramDestinations[destination] || destination

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/tram/timings/${destinationStop.codedSuburb[0]}/${destinationStop.codedName}`

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

    let directions = [
      serviceDepartures.filter(d => d.trip.gtfsDirection === '0'),
      serviceDepartures.filter(d => d.trip.gtfsDirection === '1')
    ]

    directions.forEach(direction => {
      let destinationDepartures = []
      let destinations = []

      direction.forEach(departure => {
        let destination = departure.destination + departure.loopDirection
        if (!destinations.includes(destination)) {
          destinations.push(destination)
          destinationDepartures.push({
            destination,
            departures: direction.filter(d => d.destination + d.loopDirection === destination)
          })
        }
      })

      let sortedDepartures = destinationDepartures.sort((a, b) => a.departures[0].actualDepartureTime - b.departures[0].actualDepartureTime)

      sortedDepartures.forEach(departureSet => {
        groupedDepartures[service][departureSet.destination] = departureSet.departures
      })
    })
  })

  services = services.sort((a, b) => a - b)

  //todo check 3a
  return {
    services, groupedDepartures, stop,
    classGen: departure => `tram-${departure.sortNumber}`,
    currentMode: 'tram',
    maxDepartures: 3
  }
}

router.get('/:suburb/:stopName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/grouped', response)
})

router.post('/:suburb/:stopName', async (req, res) => {
  res.render('timings/templates/grouped', await loadDepartures(req, res))
})

module.exports = router
