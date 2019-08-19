const request = require('request-promise')
const TimedCache = require('timed-cache')
const async = require('async')
const urls = require('../../../urls.json')
const getSCDepartures = require('./get_southern_cross_departures')
const moment = require('moment')
require('moment-timezone')

const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })

const cheerio = require('cheerio')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

async function getDepartures (station, db) {
  if (departuresCache.get(station.name)) {
    return departuresCache.get(station.name)
  }
  if (station.name === 'Southern Cross Railway Station') {
    let departures = await getSCDepartures(db)
    departuresCache.put(station.name, departures)

    return departures
  }

  let vnetTimetables = db.getCollection('vnet timetables')

  let now = moment().tz('Australia/Melbourne')
  let startOfToday = now.clone().startOf('day')
  let minutesPastMidnight = now.diff(startOfToday, 'minutes')
  let today = daysOfWeek[now.day()]

  let trips = await vnetTimetables.findDocuments({
    stops: {
      $elemMatch: {
        gtfsID: station.gtfsID,
        departureTimeMinutes: {
          $gt: minutesPastMidnight,
          $lte: minutesPastMidnight + 60
        }
      }
    },
    operationDays: today
  })
  let allTrips = {}
  trips.forEach(trip => { allTrips[trip.runID] = { trip } })

  let body = await request(urls.vlinePlatformDepartures.format(station.vnetStationName))
  body = body.replace(/a:/g, '')
  let $ = cheerio.load(body)
  let allServices = Array.from($('PlatformService'))

  await async.map(allServices, async service => {
    let runID = $('ServiceIdentifier', service).text()

    if (isNaN(new Date($('ActualArrivalTime', service).text()))) return
    let estimatedDepartureTime = moment($('ActualArrivalTime', service).text()) // yes arrival cos vnet
    let platform = $('Platform', service).text()

    let timetable = await vnetTimetables.findDocument({ runID, operationDays: today })
    allTrips[runID] = { trip: timetable, estimatedDepartureTime, platform }
  })

  let departures = Object.values(allTrips).map(departure => {
    departure.stopData = departure.trip.stops.filter(stop => stop.gtfsID === station.gtfsID)[0]
    departure.scheduledDepartureTime = startOfToday.clone().add(departure.stopData.departureTimeMinutes, 'minutes')

    return departure
  }).sort((a, b) => {
    return (a.estimatedDepartureTime || a.scheduledDepartureTime) - (b.estimatedDepartureTime || b.scheduledDepartureTime)
  })

  departuresCache.put(station.name, departures)

  return departures
}

module.exports = getDepartures
