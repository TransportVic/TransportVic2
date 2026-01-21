import express from 'express'
import getDepartures from '../../../modules/bus/get-departures.mjs'
import busDestinations from '../../../additional-data/bus-destinations.json' with { type: 'json' }
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

  if (!stop || !stop.bays.find(bay => bay.mode === 'bus')) {
    return res.status(404).render('errors/no-stop')
  }

  let stopHeritageUseDates = await timingUtils.getStopHeritageUseDates(res.db, stop)

  let oppositeStop = stop.oppositeStopID ? await stops.findDocument({
    _id: stop.oppositeStopID
  }) : null

  if (oppositeStop) {
    oppositeStop.bays.forEach(b => b.opposite = true)
    stop.bays.push(...oppositeStop.bays)
  }


  const departureTime = req.body && req.body.departureTime ? utils.parseTime(req.body.departureTime) : null
  let departures = await getDepartures(stop, res.db, res.tripDB, departureTime)

  const blankOld = departureTime - new Date() < 1000 * 60
  const stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)
  departures = await async.map(departures, async departure => {
    departure.pretyTimeToDeparture = utils.prettyTime(departure.actualDepartureTime, false, blankOld)
    departure.headwayDevianceClass = utils.findHeadwayDeviance(departure.scheduledDepartureTime, departure.estimatedDepartureTime, {
      early: 2,
      late: 5
    })

    departure.cleanRouteName = utils.encodeName(departure.trip.routeName)

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/bus/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${departure.operationDay || departure.trip.operationDays}#stop-${stopGTFSID}`

    let destination = utils.getDestinationName(departure.trip.destination)

    let serviceData = busDestinations.service[departure.trip.routeGTFSID] || busDestinations.service[departure.sortNumber] || {}
    departure.destination = serviceData[destination]
      || busDestinations.generic[destination] || destination

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/bus/timings/${destinationStop.cleanSuburbs[0]}/${destinationStop.cleanName}`

    return departure
  })

  let groupedDepartures = timingUtils.groupDepartures(departures)

  return {
    ...groupedDepartures,
    stop,
    classGen: departure => departure.codedOperator,
    currentMode: 'bus',
    maxDepartures: 3,
    stopHeritageUseDates,
    oppositeStop
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