const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/regional-coach/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const async = require('async')
const timingUtils = require('./timing-utils')

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    cleanNames: req.params.stopName,
    cleanSuburbs: req.params.suburb
  })

  if (!stop || !stop.bays.find(bay => bay.mode === 'regional coach')) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, stop)

  let departures = await getDepartures(stop, res.db)
  let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

  let now = utils.now()

  departures = (await async.map(departures, async departure => {
    if (departure.scheduledDepartureTime.diff(now, 'minutes') > 180) return

    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, false)
    departure.headwayDevianceClass = 'unknown'

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/coach/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}/#stop-${stopGTFSID}`

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/coach/timings/${destinationStop.cleanSuburbs[0]}/${destinationStop.cleanName}`

    return departure
  })).filter(Boolean)

  return { departures, stop, stopHeritageUseDates }
}

router.get('/:suburb/:stopName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/regional-coach', response)
})

router.post('/:suburb/:stopName', async (req, res) => {
  res.render('timings/templates/regional-coach', await loadDepartures(req, res))
})

module.exports = router
