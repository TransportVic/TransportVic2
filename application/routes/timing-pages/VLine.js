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
    return res.render('errors/no-stop')
  }

  let departures = await getDepartures(station, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.scheduledDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }

    departure.headwayDevianceClass = 'unknown'

    let stationName = station.stopName
    if (stationName === 'Southern Cross Railway Station' && departure.isTrainReplacement)
      stationName = 'Southern Cross Coach Terminal/Spencer Street'

    let stopGTFSID = departure.trip.stopTimings.find(stop => stop.stopName === stationName)

    departure.tripURL = `/${departure.isTrainReplacement ? 'coach' : 'vline'}/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${utils.getYYYYMMDDNow()}/#stop-${stopGTFSID}`

    return departure
  })

  res.render('timings/vline', { departures, station, placeholder: "Destination or platform" })
})

module.exports = router
