const express = require('express')
const router = new express.Router()
const getDepartures = require('../../modules/vline/realtime_arrivals/get_departures')

router.get('/', (req, res) => {
  res.render('index')
})

router.post('/', async (req, res) => {
  const { stn } = req.body

  res.setHeader('Content-Type', 'text/html')

  const station = await res.db.getCollection('vline railway stations').findDocument({
    name: new RegExp(stn, 'i')
  })
  if (!station) {
    res.end('Could not lookup timings for ' + stn + '. Are you sure V/Line trains stop there?')
    return
  }
  const departures = await getDepartures(station, res.db)

  let text = ''

  text += 'Services departing ' + station.name + ' are:<br />'
  Object.values(departures).map(trip => {
    trip.stopData = trip.trip.stops.filter(stop => stop.gtfsID === station.gtfsID)[0]
    return trip
  }).sort((a, b) => a.stopData.departureTimeMinutes - b.stopData.departureTimeMinutes).forEach(trip => {
    const { stopData } = trip
    const { destination } = trip.trip
    text += `The ${stopData.departureTime.slice(0, 5)} ${destination.slice(0, -16)}`

    if (trip.estDeparturetime) {
      const minutes = Math.floor((trip.estDeparturetime - new Date()) / 1000 / 60)
      text += `, departing Platform ${trip.platform}`
      if (minutes > 0) text += ` in ${minutes} minutes.`
      else text += ` now.`
    }
    text += '<br />'
  })

  res.end(text)
})

module.exports = router
