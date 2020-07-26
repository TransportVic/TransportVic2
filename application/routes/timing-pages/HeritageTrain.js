const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/heritage-train/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const async = require('async')

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let station = await stops.findDocument({
    codedName: req.params.stopName + '-railway-station'
  })

  if (!station || !station.bays.filter(bay => bay.mode === 'heritage train')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(station, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.actualDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      let minutesToDeparture = timeDifference.get('hours') * 60 + timeDifference.get('minutes')
      departure.prettyTimeToArrival = minutesToDeparture + ' m'
    }

    departure.headwayDevianceClass = 'unknown'
    departure.codedLineName = 'heritage-train'

    let day = utils.getYYYYMMDD(departure.scheduledDepartureTime)

    departure.tripURL = `/heritage/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${day}#stop-${departure.trip.stopTimings[0].stopGTFSID}`

    departure.destination = departure.trip.destination.split('/')[0]
    departure.destinationURL = `/heritage/timings/${utils.encodeName(departure.trip.destination)}`

    return departure
  })

  return { departures, station }
}

router.get('/:stopName', async (req, res) => {
  res.render('timings/heritage', await loadDepartures(req, res))
})

router.post('/:stopName', async (req, res) => {
  res.render('timings/templates/heritage', await loadDepartures(req, res))
})

module.exports = router
