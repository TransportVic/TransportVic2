const ical = require('node-ical')
const path = require('path')
const DatabaseConnection = require('./database/DatabaseConnection')
const config = require('./config')
const utils = require('./utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables

database.connect(async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
})

let rawEvents = ical.sync.parseFile(path.join(__dirname, 'additional-data/vic-holidays.ics'))
let events = Object.values(rawEvents).slice(1)

let eventCache = {}
let dayCache = {}
let nightNetworkRunning = {}

function editName(name) {
  if (name === 'Saturday before Easter Sunday') return 'Easter Saturday'
  if (name === 'Friday before the AFL Grand Final') return 'AFL Grand Final Friday'

  return name
}

events.filter(e => e.type === 'VEVENT').forEach(event => {
  try {
    let start = event.start.toISOString()
    let day = utils.parseTime(start)
    let name = editName(event.summary)

    eventCache[utils.getYYYYMMDD(day)] = name
  } catch (e) {
    global.loggers.error.err('Failed to load holiday data', event)
  }
})

function getPublicHolidayName(time) {
  return eventCache[utils.getYYYYMMDD(time)]
}

async function waitForDB() {
  for (let i = 0; i < 4; i++) {
    if (!gtfsTimetables) await utils.sleep(500)
    if (gtfsTimetables) break
  }
}

async function getPHDayOfWeek(time) {
  await waitForDB()

  let day = utils.getYYYYMMDD(time)
  if (eventCache[day]) {
    if (dayCache[day]) {
      return dayCache[day]
    } else {
      let count782 = await gtfsTimetables.countDocuments({
        operationDays: day,
        routeGTFSID: '4-782',
        mode: 'bus',
        destination: 'Frankston Railway Station/Young Street'
      })

      let hasFlinders = await gtfsTimetables.countDocuments({
        operationDays: day,
        routeGTFSID: '4-782',
        mode: 'bus',
        origin: 'Wood Street/Cook Street',
      })

      let phDay

      if (count782 === 15) phDay = 'Saturday'
      if (count782 === 14) {
        if (hasFlinders) phDay = 'Weekday'
        else phDay = 'Sunday'
      }

      dayCache[day] = phDay
      return phDay
    }
  } else {
    return null
  }
}

async function getDayOfWeek(time) {
  let phDay = await getPHDayOfWeek(time)
  let regularDay = utils.getDayOfWeek(time)
  if (!phDay || phDay === 'Weekday') return regularDay

  if (phDay === 'Saturday') return 'Sat'
  else return 'Sun'
}

async function isNightNetworkRunning(time) {
  await waitForDB()

  let day = utils.getYYYYMMDD(time)
  if (nightNetworkRunning[day]) return nightNetworkRunning[day]

  let train = await gtfsTimetables.findDocument({
    operationDays: day,
    mode: 'metro train',
    'stopTimings.0.departureTimeMinutes': {
      $gte: 1500 // 25 * 60 = 1am
    }
  })

  nightNetworkRunning[day] = !!train // If timetable exists means NN running, else not running

  return nightNetworkRunning[day]
}

module.exports = {
  getPublicHolidayName,
  getPHDayOfWeek,
  getDayOfWeek,
  isNightNetworkRunning
}
