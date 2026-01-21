import express from 'express'
import getCoachDepartures from '../../../../modules/regional-coach/get-departures.mjs'
import destinationOverrides from '../../../../additional-data/coach-stops.mjs'
import utils from '../../../../utils.mjs'
import url from 'url'
import querystring from 'querystring'

const router = new express.Router()

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

function getHumanName(fullStopName, stopSuburb) {
  return destinationOverrides.stops[`${fullStopName.replace('Shopping Centre', 'SC')} ${stopSuburb}`] || fullStopName.replace(/Railway Station.*/, '')
}

router.post('/', async (req, res) => {
  let southernCross = await res.db.getCollection('stops').findDocument({
    stopName: "Southern Cross Coach Terminal/Spencer Street"
  })

  let departures = JSON.parse(JSON.stringify(await getCoachDepartures(southernCross, res.db)))

  departures = departures.map(departure => {
    let stopsAt = departure.trip.stopTimings.filter(stop => {
      return stop.stopConditions.dropoff !== 1
    }).map(stop => getHumanName(stop.stopName, stop.suburb))
      .filter((e, i, a) => a.indexOf(e) === i).slice(1)

    if (departure.isRailReplacementBus) {
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
      isRailReplacementBus: departure.isRailReplacementBus,
      connections: (departure.trip.connections || []).filter(connection => {
        return connection.operationDays.includes(departureDay)
      }).map(connection => ({
        changeAt: getHumanName(connection.changeAt, connection.changeAtSuburb),
        for: getHumanName(connection.for, connection.forSuburb)
      }))
    }
  })
  res.json(departures)
})

export default router