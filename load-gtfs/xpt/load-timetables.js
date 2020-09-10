const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const moment = require('moment')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

const tripTimes = require('./data/trip-times.json')
const trips = require('./data/trips.json')

let gtfsID = 14

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: gtfsID })

  let totalCount = 0

  let rawCalendarDays = fs.readFileSync(path.join(__dirname, 'data', 'calendar.txt')).toString()
  let parsedCalendarDays = rawCalendarDays
    .replace(/\${START}/g, utils.getYYYYMMDDNow())
    .replace(/\${END}/g, utils.getYYYYMMDD(utils.now().add(3, 'months')))

  let calendarDays = utils.parseGTFSData(parsedCalendarDays)
  let calendarDates = []

  await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, trips, tripTimes, calendarDays, calendarDates, (headsign, routeGTFSID) => {
    return headsign === 'Melbourne' ? 'Up' : 'Down'
  })

  await updateStats('xpt-timetables', trips.length)
  console.log('Completed loading in ' + trips.length + ' xpt timetables')
  process.exit()
})
