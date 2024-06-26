const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')
const getStoppingPattern = require('../metro-trains/get-stopping-pattern')
const ptvAPI = require('../../ptv-api')
const { getDayOfWeek } = require('../../public-holidays')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let metroShunts

let routes = {
  'Alamein': '82',
  'Belgrave': '84',
  'Craigieburn': '85',
  'Cranbourne': '86',
  'Frankston': '88',
  'Glen Waverley': '89',
  'Hurstbridge': '90',
  'Lilydale': '91',
  'Pakenham': '92',
  'Sandringham': '93',
  'Mernda': '87',
  'Stony Point': '94',
  'Sunbury': '95',
  'Upfield': '96',
  'Werribee': '97',
  'Williamstown': '98'
}

async function getTimetable(id) {
  return await utils.getData('metro-op-timetable', id, async () => {
    return JSON.parse(await utils.request(urls.metroOpTimetable.format(id), { timeout: 17000 }))
  }, 1000 * 60 * 12)
}

async function getAllRunIDs() {
  return await utils.getData('metro-tdn', 'all', async () => {
    return JSON.parse(await utils.request(urls.metroRunIDs), { timeout: 17000 })
  }, 1000 * 60 * 15)
}

function dedupeRunIDs(trips) {
  let runIDsSeen = []

  return trips.filter(trip => {
    if (!runIDsSeen.includes(trip.trip_id)) {
      runIDsSeen.push(trip.trip_id)
      return true
    }

    return false
  })
}

function parseRawData(stop, startOfDay) {
  let scheduledDepartureTime = startOfDay.clone().add(stop.time_seconds, 'seconds')

  return {
    stopName: stop.station,
    stopSeconds: stop.time_seconds,
    scheduledDepartureTime,
    scheduledDepartureMinutes: Math.round(parseInt(stop.time_seconds) / 60),
    platform: stop.platform,
    cancelled: stop.status === 'C',
    runID: stop.trip_id,
    forming: stop.forms_trip_id
  }
}

async function getDepartures(routeName) {
  let routeID = routes[routeName]
  let timetable = await getTimetable(routeID)
  let allRunIDs = (await getAllRunIDs()).map(trip => trip.trip_id)

  let startOfDay = utils.now().startOf('day')
  let day = utils.getYYYYMMDD(startOfDay)
  let now = utils.now()
  let dayOfWeek = await getDayOfWeek(now)
  let metroDay = startOfDay.format('YYYY-MM-DD')

  let tripsToday = timetable.filter(trip => {
    return trip.date === metroDay
  })

  let allTrips = Object.values(tripsToday.reduce((trips, stop) => {
    let runID = stop.trip_id
    if (!trips[runID]) trips[runID] = {
      runID: runID,
      forming: stop.forms_trip_id,
      stopsAvailable: [],
      direction: runID[3] % 2 === 0 ? 'Up' : 'Down',
      operationDays: day
    }

    trips[runID].stopsAvailable.push(parseRawData(stop, startOfDay))

    return trips
  }, {})).filter(trip => trip.stopsAvailable[0].stopSeconds < 86400)
  // Filter as we can get trips for just past 3am for the next day and obv it won't match

  await async.forEach(allTrips.filter(trip => trip.stopsAvailable.length === 1), async metroTrip => {
    let trip = await liveTimetables.findDocument({
      mode: 'metro train',
      operationDays: day,
      runID: metroTrip.runID
    })

    if (!trip) {
      trip = await getStoppingPattern({
        ptvRunID: utils.getPTVRunID(metroTrip.runID)
      }, database)
    }

    if (trip) { // Trips can sometimes not appear in PTV, especially 7xxx extras
      metroTrip.stopsAvailable = trip.stopTimings.map(stop => {
        let stopTime = stop.departureTimeMinutes || stop.arrivalTimeMinutes
        return {
          stopName: stop.stopName.slice(0, -16),
          stopSeconds: stopTime * 60,
          scheduledDepartureTime: startOfDay.clone().add(stopTime, 'minutes'),
          scheduledDepartureMinutes: stopTime,
          platform: stop.platform,
          cancelled: trip.cancelled,
          runID: metroTrip.runID,
          forming: metroTrip.forming
        }
      })
    }
  })

  let firstStops = allTrips.map(trip => trip.stopsAvailable[0])
  let lastStops = allTrips.map(trip => trip.stopsAvailable[trip.stopsAvailable.length - 1])

  let shunts = lastStops.filter(trip => {
    let forming = trip.forming

    if (forming === '0') return trip.type = 'TO_YARD' || true
    if (forming.match(/^0[135]\d\d/)) { // 1/5 - LIGHTLOCO 3 - NPS/NWS
      let runID = parseInt(forming)
      trip.type = 'SHUNT_OUT'
      return true
    }

    let formingTrip = firstStops.find(nextTrip => nextTrip.runID === forming)
    if (formingTrip) {
      if (formingTrip.platform !== trip.platform) {
        trip.type = 'SHUNT_AND_REDOCK'
        trip.toPlatform = formingTrip.platform
        return true
      } else return false
    }

    if (!allRunIDs.includes(forming)) {
      trip.type = 'EMPTY_CARS'
      return true
    } else return false
  })

  let dbShunts = shunts.map(shunt => ({
    date: day,
    runID: shunt.runID,
    routeName,
    stationName: shunt.stopName,
    arrivalTimeMinutes: shunt.scheduledDepartureMinutes,
    type: shunt.type,
    platform: shunt.platform,
    ...((shunt.type === 'EMPTY_CARS' || shunt.type === 'SHUNT_OUT') ? { forming: shunt.forming } : {}),
    ...(shunt.type === 'SHUNT_AND_REDOCK' ? { toPlatform: shunt.toPlatform, forming: shunt.forming } : {})
  }))

  let shuntIDs = dbShunts.map(shunt => shunt.runID)

  await metroShunts.deleteDocuments({
    date: day,
    runID: {
      $not: {
        $in: shuntIDs
      }
    },
    routeName,
    notifyAlert: {
      $exists: false
    }
  })

  let notifyTrips = await metroShunts.distinct('runID', {
    date: day,
    notifyAlert: {
      $exists: true
    }
  })

  await async.forEach(dbShunts, async shunt => {
    if (!notifyTrips.includes(shunt.runID)) {
      await metroShunts.replaceDocument({
        date: day,
        runID: shunt.runID
      }, shunt, {
        upsert: true
      })
    }
  })
}

async function requestTimetables() {
  global.loggers.trackers.metro.info('Requesting shunt data')

  try {
    let allLines = Object.keys(routes)
    for (let line of allLines) {
      await getDepartures(line)
      await utils.sleep(3000)
    }
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to load shunts data, skipping', e)
  }
}

database.connect(async () => {
  metroShunts = database.getCollection('metro shunts')
  liveTimetables = database.getCollection('live timetables')

  schedule([
    [180, 240, 15], // Run it from 3am - 4am, taking into account website updating till ~3.30am
    [241, 359, 20],
    [360, 1380, 18],
    [1380, 1440, 20]
  ], requestTimetables, 'metro shunts', global.loggers.trackers.metro)
})
