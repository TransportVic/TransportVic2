const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/5/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/5/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/5/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/5/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 500
}, async err => {
  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'regional coach',
    headsign => null, routeGTFSID => true)

  await updateStats('coach-gtfs-timetables', tripsCount, new Date() - start)
  console.log('Completed loading in ' + tripsCount + ' V/Line Coach trips')
  process.exit()
})
