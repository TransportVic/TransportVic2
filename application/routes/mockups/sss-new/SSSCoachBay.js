const express = require('express')
const router = new express.Router()
const getCoachDepartures = require('../../../../modules/regional-coach/get-departures')
const destinationOverrides = require('../../../../additional-data/coach-stops')
const termini = require('../../../../additional-data/termini-to-lines')
const utils = require('../../../../utils')
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')

router.get('/', async (req, res) => {
  let query = querystring.parse(url.parse(req.url).query)
  let start = parseInt(query.start) || 59
  let size = parseInt(query.size) || 4

  let bays = []
  for (let i = start; i < start + size; i++) {
    bays.push(i)
  }

  res.render('mockups/sss-new/coach', { bays })
})

function getHumanName(fullStopName, stopSuburb='') {
  let stopName = fullStopName.replace('Shopping Centre', 'SC')
  let humanName = destinationOverrides[fullStopName] || destinationOverrides[`${fullStopName} (${stopSuburb})`] || fullStopName
  if (humanName.includes('Railway Station')) {
    humanName = humanName.replace(/Railway Station.*/, '').trim()
  }

  return humanName
}

router.post('/', async (req, res) => {
  let southernCross = await res.db.getCollection('stops').findDocument({
    stopName: "Southern Cross Coach Terminal/Spencer Street"
  })

  let departures = JSON.parse(JSON.stringify(await getCoachDepartures(southernCross, res.db)))

  departures = departures.map(departure => {
    let stopsAt = departure.trip.stopTimings.filter(stop => {
      return stop.stopConditions.dropoff === 0
    }).map(stop => getHumanName(stop.stopName, stop.suburb))
      .filter((e, i, a) => a.indexOf(e) === i).slice(1)

    if (departure.isTrainReplacement) {
      let bay = '64'
      let line = departure.shortRouteName

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

    let departureDay = utils.parseTime(departure.scheduledDepartureTime).format('YYYYMMDD')

    return {
      bay: departure.bay,
      destination: departure.destination.replace(/Railway Station.*/, '').trim(),
      departureTime: departure.trip.departureTime,
      stopsAt,
      isTrainReplacement: departure.isTrainReplacement,
      connections: (departure.trip.connections || []).filter(connection => {
        return connection.operationDays.includes(departureDay)
      }).map(connection => ({
        changeAt: getHumanName(connection.changeAt),
        for: getHumanName(connection.for)
      }))
    }
  })
  res.json(departures)
})

module.exports = router
