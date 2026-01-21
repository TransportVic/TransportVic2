import express from 'express'
import getDepartures from '../../../modules/vline/get-departures.mjs'
import utils from '../../../utils.mjs'
import timingUtils from './timing-utils.mjs'

const router = new express.Router()

async function loadDepartures(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    cleanName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.find(bay => bay.mode === 'regional train')) { // Not filtering xpt as we just want to check it exists
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, station)
  let stopGTFSIDs = station.bays.map(bay => bay.stopGTFSID)

  const departureTime = req.body && req.body.departureTime ? new Date(req.body.departureTime) : null
  let departures = await getDepartures(station, res.db, departureTime)

  const blankOld = departureTime - new Date() < 1000 * 60
  departures = departures.map(departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, blankOld)
    departure.headwayDevianceClass = utils.findHeadwayDeviance(departure.scheduledDepartureTime, departure.estimatedDepartureTime, {
      early: 1,
      late: 5
    }, departure.cancelled)

    let stationName = station.stopName
    if (stationName === 'Southern Cross Railway Station' && departure.isRailReplacementBus)
      stationName = 'Southern Cross Coach Terminal/Spencer Street'

    const currentStation = departure.currentStop
    departure.displayDestination = departure.isRailReplacementBus ? departure.destination : (departure.trip.stopTimings.findLast(stop => !stop.cancelled)?.stopName || departure.trip.destination).slice(0, -16)

    departure.tripURL = `/${departure.isRailReplacementBus ? 'coach' : 'vline'}/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${departure.departureDay}/#stop-${currentStation.stopGTFSID}`

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

export default router