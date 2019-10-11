const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/1/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/1/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/1/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/1/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')

database.connect({
  poolSize: 500
}, async err => {
  database.getCollection('gtfs timetables').createIndex({
    mode: 1,
    routeName: 1,
    operationDays: 1,
    destination: 1,
    tripStartHour: 1,
    tripEndHour: 1,
    tripID: 1,
    shapeID: 1
  }, {unique: true, name: "gtfs timetable index"})

  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'regional train', headsign => {
    return ['city', 'melbourne'].includes(headsign) ? 'Up' : 'Down'
  }, routeGTFSID => routeGTFSID !== '1-vPK', () => "V/Line")

  console.log('Completed loading in ' + tripsCount + ' V/Line trips')
  process.exit()
})
