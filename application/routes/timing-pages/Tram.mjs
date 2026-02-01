import express from 'express'
import getDepartures from '../../../modules/tram/get-departures.mjs'
import tramDestinations from '../../../additional-data/tram-destinations.json' with { type: 'json' }
import utils from '../../../utils.mjs'
import timingUtils from './timing-utils.mjs'
import async from 'async'

const router = new express.Router()

let cityCircleOverride = [
  20981,
  18183,
  18037
]

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    cleanNames: req.params.stopName,
    cleanSuburbs: req.params.suburb
  })

  if (!stop || !stop.bays.find(bay => bay.mode === 'tram')) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, stop)


  let departures = await getDepartures(stop, res.db, res.tripDB)

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

    if (departure.trip.routeGTFSID === '3-35') {
      if (cityCircleOverride.includes(stopGTFSID)) {
        departure.loopDirection = null
      } else {
        departure.destination = 'City Circle'
      }
    }

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/tram/timings/${destinationStop.cleanSuburbs[0]}/${destinationStop.cleanName}`

    return departure
  })

  let groupedDepartures = timingUtils.groupDepartures(departures)

  return {
    ...groupedDepartures,
    stop,
    classGen: departure => `tram-${departure.sortNumber}`,
    currentMode: 'tram',
    maxDepartures: 3,
    stopHeritageUseDates
  }
}

router.get('/:suburb/:stopName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/grouped', response)
})

router.post('/:suburb/:stopName', async (req, res) => {
  res.render('timings/templates/grouped', await loadDepartures(req, res))
})

export default router