const request = require('request-promise')
const TimedCache = require('timed-cache')
const async = require('async')
const urls = require('../../../urls.json')
const getSCDepartures = require('./get_southern_cross_departures')

const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })

const cheerio = require('cheerio')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

async function getDepartures (station, db) {
  if (departuresCache.get(station.stationName)) {
    return departuresCache.get(station.stationName)
  }
  if (station.stationName === 'Southern Cross Railway Station') {
    const departures = await getSCDepartures(db)
    departuresCache.put(station.stationName, departures)

    return departures
  }

  const vnetTimetables = db.getCollection('vnet timetables')

  const now = new Date()
  const minutesPastMidnight = now.getHours() * 60 + now.getMinutes()
  const today = daysOfWeek[now.getDay()]

  const trips = await vnetTimetables.findDocuments({
    stops: {
      $elemMatch: {
        gtfsStationID: station.gtfsStationID,
        departureTimeMinutes: {
          $gt: minutesPastMidnight,
          $lte: minutesPastMidnight + 60
        }
      }
    },
    operationDays: today
  })
  const allTrips = {}
  trips.forEach(trip => { allTrips[trip.runID] = { trip } })

  let body = await request(urls.vlinePlatformDepartures.format(station.vnetStationName))
  body = body.replace(/a:/g, '')
  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  await async.map(allServices, async service => {
    const runID = $('ServiceIdentifier', service).text()
    let estDeparturetime = new Date($('ActualArrivalTime', service).text())
    const platform = $('Platform', service).text()
    if (isNaN(estDeparturetime)) return

    estDeparturetime = new Date(estDeparturetime)
    const timetable = await vnetTimetables.findDocument({ runID, operationDays: today })
    allTrips[runID] = { trip: timetable, estDeparturetime, platform }
  })

  const departures = Object.values(allTrips).map(trip => {
    trip.stopData = trip.trip.stops.filter(stop => stop.gtfsStationID === station.gtfsStationID)[0]
    return trip
  }).sort((a, b) => a.stopData.departureTimeMinutes - b.stopData.departureTimeMinutes)

  departuresCache.put(station.stationName, departures)

  return departures
}

module.exports = getDepartures
