const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const shuffle = require('lodash.shuffle')
const cheerio = require('cheerio')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')
const { findTrip } = require('../metro-trains/get-departures')
const metroConsists = require('../../additional-data/metro-tracker/metro-consists')
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
  } else { // Turns out consist data is still available, just no departure times
    return minutes < 60
  }

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
      runID
    }

    let finalConsist = []
    let consist = run.vehicle_descriptor.id
    if (consist.match(/train\d+/)) {
      // let carriagePart =
      return // For now we don't know what this means so skip it
    }

    let carriages = consist.split('-')

    if (carriages.includes('333M') || carriages.includes('313M')) {
      let exclude = ['333M', '313M', '314M', '334M', '1017T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1017T', ...carriages, '314M', '334M']
    }

    if (carriages.length <= 2) {
      finalConsist = metroConsists.filter(consist => carriages.some(carriage => consist.includes(carriage))).reduce((a, e) => {
        return a.concat(e)
      }, [])
    } else {
      let mCars = carriages.filter(carriage => carriage.endsWith('M'))
      let tCars = carriages.filter(carriage => carriage.endsWith('T'))
      let mCarNumbers = mCars.map(carriage => parseInt(carriage.slice(0, -1)))
      let anyPair = mCarNumbers.find(carriage => {
        // Only consider odd carriage as lower & find if it has + 1
        return (carriage % 2 === 1) && mCarNumbers.some(other => other == carriage + 1)
      })

      let mtmMatched
      if (anyPair) {
        mtmMatched = metroConsists.find(consist => consist.includes(anyPair + 'M'))
      } else {
        let consistFromTCars = tCars.map(tCar => metroConsists.find(consist => consist.includes(tCar)))
        mtmMatched = consistFromTCars.find(potentialConsist => {
          return mCars.includes(potentialConsist[0]) && mCars.includes(potentialConsist[2])
        })
      }

      if (mtmMatched) {
        finalConsist = finalConsist.concat(mtmMatched)
        if (carriages.length === 6) {
          let tCarMatched = mtmMatched[1]
          let otherCars = carriages.filter(carriage => !mtmMatched.includes(carriage))
          let otherConsist = [otherCars[1], otherCars[0], otherCars[2]]
          finalConsist = finalConsist.concat(otherConsist)
        }
      } else {
        finalConsist = carriages
      }
    }

    let tripData = {
      ...query,
      origin: trip.trueOrigin.slice(0, -16),
      destination: trip.trueDestination.slice(0, -16),
      departureTime: trip.trueDepartureTime,
      destinationArrivalTime: trip.trueDestinationArrivalTime,
      consist: finalConsist
    }

    await metroTrips.replaceDocument(query, tripData, {
      upsert: true
    })
  })
}

async function requestTimings() {
  let stop = pickRandomStop()
  console.log('requesting timings for', stop)

  try {
    await getDepartures(stop)
  } catch (e) {
    console.log(e)
    console.log('Failed to get metro trips this round, skipping')
  }

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
