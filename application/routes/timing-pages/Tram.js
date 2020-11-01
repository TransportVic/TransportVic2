const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/tram/get-departures')
const getDeparturesExperimental = require('../../../modules/tram/get-departures-experimental')
const moment = require('moment')
const utils = require('../../../utils')
const tramDestinations = require('../../../additional-data/tram-destinations')
const async = require('async')
const timingUtils = require('./timing-utils')

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.find(bay => bay.mode === 'tram')) {
    return res.status(404).render('errors/no-stop')
  }

  // let departures = await getDepartures(stop, res.db)
  let departures = await getDeparturesExperimental(stop, res.db)

  let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

  departures = await async.map(departures, async departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, false, false)
    departure.headwayDevianceClass = utils.findHeadwayDeviance(departure.scheduledDepartureTime, departure.estimatedDepartureTime, {
      early: 2,
      late: 5
    })

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let firstStop = departure.trip.stopTimings[0]

    let minutesDiff = currentStop.departureTimeMinutes - firstStop.departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/tram/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}/#stop-${stopGTFSID}`

    let destination = utils.getDestinationName(departure.trip.destination)
    departure.destination = tramDestinations[destination] || destination

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/tram/timings/${destinationStop.codedSuburb[0]}/${destinationStop.codedName}`

    return departure
  })

  let groupedDepartures = timingUtils.groupDepartures(departures)

  //todo check 3a
  return {
    ...groupedDepartures,
    stop,
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
