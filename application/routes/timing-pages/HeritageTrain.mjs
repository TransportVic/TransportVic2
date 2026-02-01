import express from 'express'
import getDepartures from '../../../modules/heritage-train/get-departures.js'
import utils from '../../../utils.mjs'
import timingUtils from './timing-utils.mjs'

const router = new express.Router()

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let station = await stops.findDocument({
    cleanName: req.params.stopName + '-railway-station'
  })

  let heritageStop = station.bays.find(bay => bay.mode === 'heritage train')

  if (!station || !heritageStop) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, station)
  let now = +new Date()
  let msDay = 1440 * 60 * 1000
  let heritageStopActive = null

  if (heritageStop.stopGTFSID > 13100000) {
    heritageStopActive = stopHeritageUseDates.some(date => Math.abs(now - date) <= msDay)
  }

  let departures = await getDepartures(station, res.db)
  let stopGTFSIDs = station.bays.map(bay => bay.stopGTFSID)

  departures = departures.map(departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, false)

    departure.headwayDevianceClass = 'unknown'
    departure.cleanRouteName = 'heritage-train'

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/heritage/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}#stop-${stopGTFSID}`

    departure.destination = utils.getStopName(departure.trip.destination)
    departure.destinationURL = `/heritage/timings/${utils.encodeName(departure.trip.destination).slice(0, -16)}`

    return departure
  })

  return { departures, station, stopHeritageUseDates, heritageStopActive }
}

router.get('/:stopName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/heritage', response)
})

router.post('/:stopName', async (req, res) => {
  res.render('timings/templates/heritage', await loadDepartures(req, res))
})

export default router