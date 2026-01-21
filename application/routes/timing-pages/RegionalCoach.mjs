import express from 'express'
import getDepartures from '../../../modules/regional-coach/get-departures.mjs'
import utils from '../../../utils.mjs'
import async from 'async'
import timingUtils from './timing-utils.mjs'

const router = new express.Router()

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

  const departureTime = req.body && req.body.departureTime ? new Date(req.body.departureTime) : null
  let departures = await getDepartures(stop, res.db, departureTime)

  const blankOld = departureTime - new Date() < 1000 * 60
  departures = (await async.map(departures, async departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, true, blankOld)
    departure.headwayDevianceClass = 'unknown'

    const currentStop = departure.currentStop
    departure.tripURL = `/coach/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${departure.departureDay}/#stop-${currentStop.stopGTFSID}`

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

export default router