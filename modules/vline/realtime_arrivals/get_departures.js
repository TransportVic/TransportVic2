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
  if (departuresCache.get(station.stopName)) {
    return departuresCache.get(station.stopName)
  }
  let scDepartures = []
  if (station.stopName === 'Southern Cross Railway Station') {
    scDepartures = await getSCDepartures(db)
  }

  let vlinePlatform = station.bays.filter(bay => bay.mode === 'regional train')[0]
  let {vnetStationName} = vlinePlatform

  const timetables = db.getCollection('timetables')

  const now = moment().tz('Australia/Melbourne')
  const startOfToday = now.clone().startOf('day')
  const minutesPastMidnight = now.diff(startOfToday, 'minutes')
  const today = daysOfWeek[now.day()]

  // const trips = await timetables.findDocuments({
  //   stopTimings: {
  //     $elemMatch: {
  //       stopGTFSID: vlinePlatform.stopGTFSID,
  //       departureTimeMinutes: {
  //         $gt: minutesPastMidnight,
  //         $lte: minutesPastMidnight + 60
  //       }
  //     }
  //   },
  //   operationDays: today,
  //   mode: "regional train"
  // }).toArray()
const trips=[]
  const allTrips = {}
  trips.forEach(trip => { allTrips[trip.runID] = { trip } })

  let body = await request(urls.vlinePlatformDepartures.format(vnetStationName))
  body = body.replace(/a:/g, '')
  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  await async.forEach(allServices, async service => {
    const runID = $('ServiceIdentifier', service).text()

    let estimatedDepartureTime

    if (!isNaN(new Date($('ActualArrivalTime', service).text()))) { estimatedDepartureTime = moment($('ActualArrivalTime', service).text()) } // yes arrival cos vnet
    const platform = $('Platform', service).text()

    const timetable = await timetables.findDocument({
      runID, operationDays: today, mode: "regional train"
    })

    if (!timetable) return // footy trains?

    allTrips[runID] = { trip: timetable, estimatedDepartureTime, platform }
  })

  let departures = Object.values(allTrips).map(departure => {
    departure.stopData = departure.trip.stopTimings.filter(stop => stop.stopGTFSID === vlinePlatform.stopGTFSID)[0]
    let offset = 0
    if (departure.stopData.departureTimeMinutes < 180) { // currently after 11pm and train leaves < 2am
      offset = 1440 // add 1 day to departure time from today
    }
    departure.scheduledDepartureTime = startOfToday.clone().add(departure.stopData.departureTimeMinutes + offset, 'minutes')
    departure.departureTimeMinutes = departure.stopData.departureTimeMinutes + offset

    return departure
  }).filter(departure => {
    return departure.estimatedDepartureTime || minutesPastMidnight > departure.departureTimeMinutes - 120
  })

  let runIDs = departures.map(departure => departure.trip.runID);

  scDepartures.forEach(departure => {
    if (runIDs.includes(departure.trip.runID)) {
      let departureIndex = runIDs.indexOf(departure.trip.runID);
      if (!departures[departureIndex].estimatedDepartureTime) {
        departures.splice(departureIndex, 1)
        runIDs.splice(departureIndex, 1)

        departures.push(departure)
        runIDs.push(departure.trip.runID)
      }
    } else {
      runIDs.push(departure.trip.runID)
      departures.push(departure)
    }
  })

  departures = departures.sort((a, b) => {
    return (a.estimatedDepartureTime || a.scheduledDepartureTime) - (b.estimatedDepartureTime || b.scheduledDepartureTime)
  })

  departuresCache.put(station.stopName, departures)

  return departures
}

module.exports = getDepartures
