const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/ferry/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const async = require('async')

router.get('/:stopName', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    codedName: req.params.stopName
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'ferry')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(stop, res.db)

  departures = await async.map(departures, async departure => {
    const timeDifference = moment.utc(departure.actualDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      let minutesToDeparture = timeDifference.get('hours') * 60 + timeDifference.get('minutes')
      departure.prettyTimeToArrival = minutesToDeparture + ' m'
    }

    departure.headwayDevianceClass = 'unknown'
    departure.codedLineName = 'ferry'

    let day = utils.getYYYYMMDD(departure.scheduledDepartureTime)

    departure.tripURL = `/ferry/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${day}#stop-${departure.trip.stopTimings[0].stopGTFSID}`

    departure.destination = departure.trip.destination.split('/')[0]

    let destinationStopTiming = departure.trip.stopTimings.slice(-1)[0]
    let destinationStop = await stops.findDocument({
      'bays.stopGTFSID': destinationStopTiming.stopGTFSID
    })

    departure.destinationURL = `/bus/timings/${destinationStop.codedSuburb[0]}/${destinationStop.codedName}`

    return departure
  })

  res.render('timings/ferry', { departures, stop })
})

module.exports = router
