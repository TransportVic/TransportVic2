const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/vline-old/get-departures')
const utils = require('../../../utils')
const moment = require('moment')
const timingUtils = require('./timing-utils')

async function loadDepartures(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    cleanName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.find(bay => bay.mode === 'regional train')) { // Not filtering xpt as we just want to check it exists
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, station)

  let departures = await getDepartures(station, res.db)
  let stopGTFSIDs = station.bays.map(bay => bay.stopGTFSID)

  departures = departures.map(departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, false)
    departure.headwayDevianceClass = utils.findHeadwayDeviance(departure.scheduledDepartureTime, departure.estimatedDepartureTime, {
      early: 1,
      late: 5
    })

    let stationName = station.stopName
    if (stationName === 'Southern Cross Railway Station' && departure.isRailReplacementBus)
      stationName = 'Southern Cross Coach Terminal/Spencer Street'

    let currentStation = departure.trip.stopTimings.find(tripStop => tripStop.stopName === stationName || stopGTFSIDs.includes(tripStop.stopGTFSID))
    let { stopGTFSID } = currentStation
    let minutesDiff = currentStation.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/${departure.isRailReplacementBus ? 'coach' : 'vline'}/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}/#stop-${stopGTFSID}`

    return departure
  })

  return {
    departures,
    station,
    placeholder: "Destination or platform",
    stopHeritageUseDates
  }
}

router.get('/:stationName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/vline', response)
})

router.post('/:stationName', async (req, res) => {
  res.render('timings/templates/vline', await loadDepartures(req, res))
})

module.exports = router
