const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/vline/get-departures')
const utils = require('../../../utils')
const moment = require('moment')

async function loadDepartures(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.find(bay => bay.mode === 'regional train')) { // Not filtering xpt as we just want to check it exists
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(station, res.db)

  departures = departures.map(departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, false)

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

    let stationName = station.stopName
    if (stationName === 'Southern Cross Railway Station' && departure.isRailReplacementBus)
      stationName = 'Southern Cross Coach Terminal/Spencer Street'

    let currentStation = departure.trip.stopTimings.find(tripStop => tripStop.stopName === stationName)
    let {stopGTFSID} = currentStation
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
    placeholder: "Destination or platform"
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
