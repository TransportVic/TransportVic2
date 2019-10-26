const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/3/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/3/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/3/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/3/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({}, async err => {
  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'tram',
    headsign => null, routeGTFSID => true)

  await updateStats('tram-gtfs-timetables', tripsCount, new Date() - start)
  console.log('Completed loading in ' + tripsCount + ' tram trips')
  process.exit()
})
