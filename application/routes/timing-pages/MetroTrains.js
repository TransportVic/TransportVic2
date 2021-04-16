const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const timingUtils = require('./timing-utils')

async function loadDepartures(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName + '-railway-station'
  })

  let metroPlatform = station ? station.bays.find(bay => bay.mode === 'metro train') : null

  if (!station || !metroPlatform) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, station)

  let departures = await getDepartures(station, res.db)

  departures = departures.map(departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, false)
    departure.headwayDevianceClass = utils.findHeadwayDeviance(departure.scheduledDepartureTime, departure.estimatedDepartureTime, {
      early: 0.5,
      late: 5
    })

    let {trip} = departure

    let origin = trip.trueOrigin.slice(0, -16)
    let originDepartureTime = trip.trueDepartureTime
    let destination = trip.trueDestination.slice(0, -16)
    let destinationArrivalTime = trip.trueDestinationArrivalTime

    let stopGTFSID = metroPlatform.stopGTFSID

    departure.tripURL = `${utils.encodeName(origin)}/${originDepartureTime}/`
      + `${utils.encodeName(destination)}/${destinationArrivalTime}/`
      + `${departure.trueDepartureDay}/${stopGTFSID ? `#stop-${stopGTFSID}` : ''}`

    departure.destinationURL = `/metro/timings/${utils.encodeName(trip.trueDestination).slice(0, -16)}`

    return departure
  })

  return {
    departures,
    station,
    placeholder: 'Destination or platform',
    stopHeritageUseDates
  }
}

router.get('/:stationName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/metro-trains', response)
})

router.post('/:stationName', async (req, res) => {
  res.render('timings/templates/metro-trains', await loadDepartures(req, res))
})

module.exports = router
