const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/vline/realtime_arrivals/get_departures')
const moment = require('moment')

let lineTypes = {
  short: ['Geelong', 'Ballarat', 'Bendigo', 'Seymour', 'Traralgon'],
  long: ['Warrnambool', 'Ararat', 'Maryborough', 'Swan Hill', 'Echuca', 'Albury', 'Shepparton', 'Bairnsdale']
}

router.get('/:stationName', async (req, res) => {
  const station = await res.db.getCollection('vline railway stations').findDocument({
    codeName: req.params.stationName
  })

  if (!station) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stationName + '. Are you sure V/Line trains stop there?')
  }

  let departures = await getDepartures(station, res.db)
  departures = departures.map(departure => {
    const timeDifference = moment.utc((departure.estimatedDepartureTime || departure.scheduledDepartureTime).diff(moment()))

    if (+timeDifference <= 0) departure.prettyTimeToArrival = 'Now'
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

    return departure
  })

  res.render('timings/vline', { departures, station, placeholder: "Destination or platform" })
})

module.exports = router
