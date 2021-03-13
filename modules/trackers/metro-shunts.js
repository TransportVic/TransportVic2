const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')
const getStoppingPattern = require('../utils/get-stopping-pattern')
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
    return JSON.parse(await utils.request(urls.op.format(id), { timeout: 6000 }))
  }, 1000 * 60 * 12)
}

async function getAllRunIDs() {
  return await utils.getData('metro-tdn', 'all', async () => {
    return JSON.parse(await utils.request(urls.runIDs))
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

  let tripsAscending = tripsToday.slice(0).sort((a, b) => parseInt(a.time_seconds) - parseInt(b.time_seconds))
  let tripsDescending = tripsToday.slice(0).sort((a, b) => parseInt(b.time_seconds) - parseInt(a.time_seconds))

  let firstStops = dedupeRunIDs(tripsAscending)
  let lastStops = dedupeRunIDs(tripsDescending)

  let shunts = lastStops.filter(trip => {
    let forming = trip.forms_trip_id

    if (forming === '0') return trip.type = 'TO_YARD' || true
    if (forming.startsWith('0')) {
      let runID = parseInt(forming)
      if (!(700 <= runID && runID <= 899)) { // City Circle
        trip.type = 'SHUNT_OUT'
        return true
      } else return false
    }

    let formingTrip = firstStops.find(nextTrip => nextTrip.trip_id === forming)
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
    runID: shunt.trip_id,
    routeName,
    stationName: shunt.station,
    arrivalTimeMinutes: Math.round(shunt.time_seconds / 60),
    type: shunt.type,
    platform: shunt.platform,
    ...((shunt.type === 'EMPTY_CARS' || shunt.type === 'SHUNT_OUT') ? { forming: shunt.forms_trip_id } : {}),
    ...(shunt.type === 'SHUNT_AND_REDOCK' ? { toPlatform: shunt.toPlatform } : {})
  }))

  let shuntIDs = dbShunts.map(shunt => shunt.runID)

  await metroShunts.deleteDocuments({
    date: day,
    runID: {
      $not: {
        $in: shuntIDs
      }
    },
    routeName
  })

  await async.forEach(dbShunts, async shunt => {
    if (await metroShunts.countDocuments({ date: day, runID: shunt.runID }) === 0) {
      await metroShunts.createDocument(shunt)
    }
  })
}

async function requestTimetables() {
  global.loggers.trackers.metro.info('Requesting shunt data')

  try {
    let allLines = Object.keys(routes)
    for (let line of allLines) {
      await getDepartures(line)
      await utils.sleep(5000)
    }
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to load shunts data, skipping', e)
  }
}


database.connect(async () => {
  metroShunts = database.getCollection('metro shunts')

  schedule([
    [360, 1380, 18]
  ], requestTimetables, 'metro shunts', global.loggers.trackers.metro)
})
