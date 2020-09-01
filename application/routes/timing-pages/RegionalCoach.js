const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/regional-coach/get-departures')
const moment = require('moment')
const utils = require('../../../utils')

async function loadDepartures(req, res) {
  const stop = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stopName
  })

  let coachBay = stop.bays.filter(bay => bay.mode === 'regional coach')

  if (!stop || !coachBay.length) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(stop, res.db)
  let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.scheduledDepartureTime.diff(utils.now()))

    if (+timeDifference > 1000 * 60 * 180) return null
    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }

    departure.headwayDevianceClass = 'unknown'

    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
    let {stopGTFSID} = currentStop
    let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    departure.tripURL = `/coach/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${operationDate}/#stop-${stopGTFSID}`

    return departure
  }).filter(Boolean)

  return { departures, stop }
}

router.get('/:stopName', async (req, res) => {
  res.render('timings/regional-coach', await loadDepartures(req, res))
})

router.post('/:stopName', async (req, res) => {
  res.render('timings/templates/regional-coach', await loadDepartures(req, res))
})

module.exports = router
