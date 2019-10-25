const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')

const calendar = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/calendar.txt`).toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/calendar_dates.txt`).toString())
const trips = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/trips.txt`).toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/stop_times.txt`).toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({}, async err => {
  database.getCollection('gtfs timetables').createIndex({
    mode: 1,
    routeName: 1,
    routeGTFSID: 1,
    operationDays: 1,
    destination: 1,
    tripStartHour: 1,
    tripEndHour: 1,
    tripID: 1,
    shapeID: 1
  }, {unique: true, name: "gtfs timetable index"})

  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'bus',
    headsign => null, routeGTFSID => true)

  await updateStats('bus-gtfs-timetables', tripsCount, new Date() - start)
  console.log('Completed loading in ' + tripsCount + ' bus trips')
  process.exit()
})
