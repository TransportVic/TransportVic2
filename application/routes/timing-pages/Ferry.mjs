import express from 'express'
import getDepartures from '../../../modules/ferry/get-departures.mjs'
import utils from '../../../utils.mjs'
import timingUtils from './timing-utils.mjs'

const router = new express.Router()

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    cleanName: req.params.stopName
  })

  if (!stop || !stop.bays.find(bay => bay.mode === 'ferry')) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, stop)

  let departures = await getDepartures(stop, res.db)
  let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

  departures = departures.map(departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, false)

    departure.headwayDevianceClass = 'unknown'
    departure.cleanRouteName = 'ferry'

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/ferry/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}#stop-${stopGTFSID}`

    departure.destination = utils.getStopName(departure.trip.destination)
    departure.destinationURL = `/ferry/timings/${utils.encodeName(departure.trip.destination)}`

    return departure
  })

  return { departures, stop, stopHeritageUseDates }
}

router.get('/:stopName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/ferry', response)
})

router.post('/:stopName', async (req, res) => {
  res.render('timings/templates/ferry', await loadDepartures(req, res))
})

export default router