const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/1/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/1/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/1/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/1/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 500
}, async err => {
  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'regional train', headsign => {
    return ['city', 'melbourne'].includes(headsign) ? 'Up' : 'Down'
  }, routeGTFSID => routeGTFSID !== '1-vPK')

  await updateStats('vline-gtfs-timetables', tripsCount, new Date() - start)
  console.log('Completed loading in ' + tripsCount + ' V/Line trips')
  process.exit()
})
