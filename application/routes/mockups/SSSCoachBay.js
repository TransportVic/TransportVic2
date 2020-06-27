const express = require('express')
const router = new express.Router()
const getCoachDepartures = require('../../../modules/regional-coach/get-departures')
const destinationOverrides = require('../../../additional-data/coach-stops')
const termini = require('../../../additional-data/termini-to-lines')

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

    if (departure.isTrainReplacement) {
      let bay = '64'

      let line = termini[departure.trip.stopTimings.slice(-1)[0].stopName.slice(0, -16)]

      switch (line) {
        case 'Geelong':
        case 'Warrnambool':
          bay = '63'
          break

        case 'Ballarat':
        case 'Ararat':
        case 'Maryborough':
          bay = '65'
          break

        case 'Bendigo':
        case 'Echuca':
        case 'Swan Hill':
          bay = '66'
          break

        case 'Seymour':
        case 'Shepparton':
        case 'Albury':
          bay = '67'
          break

        case 'Traralgon':
        case 'Bairnsdale':
          bay = '69'
          break
      }

      departure.bay = 'Bay ' + bay
    } else if (!departure.bay) departure.bay = 'Bay 68'

    return {
      bay: departure.bay,
      destination: departure.destination.replace(/Railway Station.*/, '').trim(),
      departureTime: departure.trip.departureTime,
      stopsAt,
      isTrainReplacement: departure.isTrainReplacement,
      connections: (departure.trip.connections || []).filter(connection => {
        return connection.operationDays.includes(departure.trip.operationDay)
      }).map(connection => ({
        changeAt: destinationOverrides[connection.changeAt],
        for: destinationOverrides[connection.for]
      }))
    }
  })
  res.json(departures)
})

module.exports = router
