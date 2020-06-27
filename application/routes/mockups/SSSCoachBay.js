const express = require('express')
const router = new express.Router()
const getCoachDepartures = require('../../../modules/regional-coach/get-departures')
const destinationOverrides = require('../../../additional-data/coach-stops')

router.get('/', async (req, res) => {
  res.render('mockups/sss-new/coach')
})

router.post('/', async (req, res) => {
  let southernCross = await res.db.getCollection('stops').findDocument({
    stopName: "Southern Cross Coach Terminal/Spencer Street"
  })

  let departures = await getCoachDepartures(southernCross, res.db)
  departures = departures.map(departure => {
    let stopsAt = departure.trip.stopTimings.filter(stop => {
      return stop.stopConditions.dropoff === 0
    }).map(stop => {
      let stopname = stop.stopName.replace('Shopping Centre', 'SC')
      let humanName = destinationOverrides[stopname] || destinationOverrides[`${stopname} (${stop.suburb})`] || stopname
      if (humanName.includes('Railway Station')) {
        humanName = humanName.replace(/Railway Station.*/, '').trim()
      }

      return humanName
    }).filter((e, i, a) => a.indexOf(e) === i).slice(1)

    if (departure.isTrainReplacement) departure.bay = 'Bay 62'

    return {
      bay: departure.bay,
      destination: departure.destination.replace(/Railway Station.*/, '').trim(),
      departureTime: departure.trip.departureTime,
      stopsAt,
      isTrainReplacement: departure.isTrainReplacement,
      connections: (departure.trip.connections || []).map(connection => ({
        changeAt: destinationOverrides[connection.changeAt],
        for: destinationOverrides[connection.for]
      }))
    }
  })
  res.json(departures)
})

module.exports = router
