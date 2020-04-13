const ical = require('node-ical')
const path = require('path')
const moment = require('moment')
const DatabaseConnection = require('./database/DatabaseConnection')
const config = require('./config.json')
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

function editName(name) {
  if (name === 'Saturday before Easter Sunday') return 'Easter Saturday'
  if (name === 'Friday before the AFL Grand Final') return 'AFL Grand Final Friday'

  return name
}

events.forEach(event => {
  let start = event.start.toISOString()
  let day = moment.tz(start, 'Australia/Melbourne')
  let name = editName(event.summary)

  eventCache[day.format('YYYYMMDD')] = name
})

function getPublicHolidayName(moment) {
  return eventCache[moment.format('YYYYMMDD')]
}

async function getPHDayOfWeek(moment) {
  let day = moment.format('YYYYMMDD')
  if (eventCache[day]) {
    if (dayCache[day]) {
      return dayCache[day]
    } else {
      let styCount = await gtfsTimetables.countDocuments({
        operationDays: day,
        routeGTFSID: '2-SPT',
        mode: 'metro train',
        direction: 'Up'
      })
      let phDay
      if (styCount === 10) phDay = 'Weekday'
      if (styCount === 12) phDay = 'Friday'
      if (styCount === 8) phDay = 'Saturday'
      if (styCount === 7) phDay = 'Sunday'

      dayCache[day] = phDay
      return phDay
    }
  } else {
    return null
  }
}

module.exports = {
  getPublicHolidayName,
  getPHDayOfWeek
}
