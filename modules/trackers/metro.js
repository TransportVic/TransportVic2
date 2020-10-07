const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const shuffle = require('lodash.shuffle')
const cheerio = require('cheerio')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')
const { findTrip } = require('../metro-trains/get-departures')
const metroConsists = require('../../additional-data/metro-consists')
const stops = require('../../additional-data/metro-tracker/stops')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let metroTrips
let refreshRate = 0.5

let token
let cacheTime

async function getToken() {
  if (cacheTime && (new Date - cacheTime) < 1000 * 60 * 60) { // Cache key for 1hr max
    return token
  }

  let ptvData = await utils.request(urls.metroTrackerBase, {
    timeout: 6000
  })
  let $ = cheerio.load(ptvData)

  token = $('#fetch-key').val()
  cacheTime = new Date()

  return token
}

function isDay() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 300 <= minutes && minutes <= 1320 // 0500 - 2200
}

function isNight() {
  let minutes = utils.getMinutesPastMidnightNow()
  let dayOfWeek = utils.getDayName(utils.now())

  if (1321 <= minutes && minutes <= 1439) return true

  if (['Sat', 'Sun'].includes(dayOfWeek)) { // Considering the true day, NN runs on sat & sun morn
    return minutes < 300
  } // Do not bother with after midnight as the data is always timetabled
  // However with NN it is more troublesome to define 0-3am as excluded so...

  return false
}

function updateRefreshRate() {
  if (isDay()) refreshRate = 0.5
  else if (isNight()) refreshRate = 3
  else {
    let minutes = utils.getMinutesPastMidnightNow()
    if (minutes < 300) minutes += 1440

    refreshRate = 1740 - minutes + 1
    console.log('Metro Tracker going to sleep for ' + refreshRate + ' minutes')
  }
}

let stopNames = Object.keys(stops)

function pickRandomStop() {
  return shuffle(stopNames)[0]
}

async function getDepartures(stop) {
  let stopCode = stops[stop]
  let stopData = await dbStops.findDocument({ stopName: stop + ' Railway Station' })

  let stopURL = urls.metroTracker.format(stopCode, await getToken())
  let data = JSON.parse(await utils.request(stopURL))
  let viableDepartures = data.departures.filter(departure => !!departure.run.vehicle_descriptor)
  await async.forEach(viableDepartures, async viableDeparture => {
    let scheduledDepartureTime = utils.parseTime(viableDeparture.scheduled_departure_utc)
    let { run, route } = viableDeparture
    let ptvRunID = run.run_id

    let { trip, runID } = await findTrip(database, viableDeparture, scheduledDepartureTime, run, ptvRunID, {
      route_name: route.short_label,
      route_id: route.id
    }, stopData, [])

    let currentStation = trip.stopTimings.find(tripStop => tripStop.stopName === stopData.stopName)
    let {stopGTFSID} = currentStation
    let firstStop = trip.stopTimings[0]

    let fss = trip.stopTimings.find(tripStop => tripStop.stopName === 'Flinders Street Railway Station')
    if (trip.direction === 'Down' && fss) firstStop = fss
    let minutesDiff = currentStation.departureTimeMinutes - firstStop.departureTimeMinutes

    let tripStart = scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    let query = {
      date: operationDate,
      runID,
      origin: trip.trueOrigin,
      destination: trip.trueDestination,
      departureTime: trip.trueDepartureTime,
      destinationArrivalTime: trip.trueDestinationArrivalTime
    }

    let consist = run.vehicle_descriptor.id
    let carriages = consist.split('-')
    let mCars = carriages.filter(carriage => carriage.endsWith('M'))
    let setsFromMCars = metroConsists.filter(set => mCars.some(mCar => set.includes(mCar)))

    let tripData = {
      ...query,
      consist: setsFromMCars.reduce((a, b) => a.concat(b), [])
    }

    await metroTrips.replaceDocument(query, tripData, {
      upsert: true
    })
  })
}

async function requestTimings() {
  let stop = pickRandomStop()
  console.log('requesting timings for', stop)

  await getDepartures(stop)

  updateRefreshRate()
  setTimeout(requestTimings, refreshRate * 60 * 1000)
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  metroTrips = database.getCollection('metro trips')
  if (!isNight() && !isDay()) {
    updateRefreshRate()
    setTimeout(requestTimings, refreshRate * 60 * 1000)
  } else {
    await requestTimings()
  }
})
