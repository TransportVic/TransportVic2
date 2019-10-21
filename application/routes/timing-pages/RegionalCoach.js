const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/regional-coach/get-departures')
const moment = require('moment')
const utils = require('../../../utils')

router.get('/:stopName', async (req, res) => {
  const stop = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stopName
  })

  let coachBay = stop.bays.filter(bay => bay.mode === 'regional coach')

  if (!stop || !coachBay.length) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stopName + '. Are you sure regional coaches stop there?')
  }

  let departures = await getDepartures(stop, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.scheduledDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }

    departure.headwayDevianceClass = 'unknown'

    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    departure.tripURL = `/regional-coach/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + utils.getYYYYMMDDNow()

    return departure
  })

  res.render('timings/regional-coach', { departures, stop })
})

module.exports = router
