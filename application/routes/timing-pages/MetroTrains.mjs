import express from 'express'
import getDepartures from '../../../modules/metro-trains/get-departures.mjs'
import utils from '../../../utils.mjs'
import timingUtils from './timing-utils.mjs'
import { getImportantDelays, getStationAlerts, shouldShowDelays } from '../../../modules/metro-trains/metro-notify.mjs'

const router = new express.Router()

async function loadDepartures(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    cleanName: req.params.stationName + '-railway-station'
  })

  let metroPlatform = station ? station.bays.find(bay => bay.mode === 'metro train' && !bay.parentStopGTFSID) : null

  if (!station || !metroPlatform) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, station)

  const departureTime = req.body && req.body.departureTime ? new Date(req.body.departureTime) : null
  let departures = await getDepartures(station, res.db, false, false, departureTime)
  const notifyAlerts = await getStationAlerts(station, res.db)

  const blankOld = departureTime - new Date() < 1000 * 60
  departures = departures.map(departure => {
    departure.prettyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, blankOld)
    departure.headwayDevianceClass = utils.findHeadwayDeviance(departure.scheduledDepartureTime, departure.estimatedDepartureTime, {
      early: 0.5,
      late: 5
    }, departure.cancelled)

    let {trip} = departure

    let origin = trip.origin.slice(0, -16)
    let originDepartureTime = trip.departureTime
    let destination = trip.destination.slice(0, -16)
    let destinationArrivalTime = trip.destinationArrivalTime

    let stopGTFSID = metroPlatform.stopGTFSID

    if (departure.formingTrip && departure.formingType === 'CITY_LOOP') {
      let formingTrip = departure.formingTrip
      origin = formingTrip.origin.slice(0, -16)
      originDepartureTime = formingTrip.departureTime
      destination = formingTrip.destination.slice(0, -16)
      destinationArrivalTime = formingTrip.destinationArrivalTime
    }

    departure.tripURL = `${utils.encodeName(origin)}/${originDepartureTime}/`
      + `${utils.encodeName(destination)}/${destinationArrivalTime}/`
      + `${departure.departureDay}/${stopGTFSID ? `#stop-${stopGTFSID}` : ''}`

    departure.destinationURL = `/metro/timings/${utils.encodeName(trip.destination).slice(0, -16)}`
    if (departure.formingDestination) {
      departure.destinationURL = `/metro/timings/${utils.encodeName(departure.formingDestination)}`
    }

    departure.notifyAlert = notifyAlerts.individual.find(alert => alert.runID === departure.runID)
    departure.suspension = notifyAlerts.suspended[departure.routeName]
    const delayAlert = notifyAlerts.delays[departure.routeName]
    if (delayAlert && (!delayAlert.direction || delayAlert.direction === departure.trip.direction)) {
      departure.delayAlert = delayAlert
    }

    return departure
  })

  return {
    departures,
    station,
    placeholder: 'Destination or platform',
    stopHeritageUseDates,
    notifyAlerts,
    importantDelays: getImportantDelays(station, notifyAlerts)
  }
}

router.get('/:stationName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/metro-trains', response)
})

router.post('/:stationName', async (req, res) => {
  res.render('timings/templates/metro-trains', await loadDepartures(req, res))
})

export default router