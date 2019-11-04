const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/vline/get-departures')
const utils = require('../../../utils')
const moment = require('moment')

let lineTypes = {
  short: ['Geelong', 'Ballarat', 'Bendigo', 'Seymour', 'Traralgon'],
  long: ['Warrnambool', 'Ararat', 'Maryborough', 'Swan Hill', 'Echuca', 'Albury', 'Shepparton', 'Bairnsdale']
}

router.get('/:stationName', async (req, res) => {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.filter(bay => bay.mode === 'regional train')) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stationName + '. Are you sure V/Line trains stop there?')
  }

  let departures = await getDepartures(station, res.db)
  // console.log(departures)
  departures = departures.map(departure => {
    const timeDifference = moment.utc((departure.estimatedDepartureTime || departure.scheduledDepartureTime).diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }

    departure.headwayDevianceClass = 'unknown'
    if (departure.estimatedDepartureTime) {
      departure.headwayDeviance = departure.scheduledDepartureTime.diff(departure.estimatedDepartureTime, 'minutes')

      // trains cannot be early
      let lateThreshold = 6
      if (lineTypes.long.includes(departure.trip.line))
        lateThreshold = 11
      if (departure.headwayDeviance <= -lateThreshold) { // <= 6min counts as late
        departure.headwayDevianceClass = 'late'
      } else {
        departure.headwayDevianceClass = 'on-time'
      }
    }

    let stopGTFSID = departure.trip.stopTimings.filter(stop => stop.stopName === station.stopName)[0].stopGTFSID

    departure.tripURL = `/${departure.isCoachService ? 'regional-coach' : 'vline'}/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${utils.getYYYYMMDDNow()}/#stop-${stopGTFSID}`

    if (departure.isCoachService) {
      departure.trip.origin = departure.trip.origin.replace(' Railway Station', '')
      departure.trip.destination = departure.trip.destination.replace(' Railway Station', '')
    }

    return departure
  })

  res.render('timings/vline', { departures, station, placeholder: "Destination or platform" })
})

module.exports = router
