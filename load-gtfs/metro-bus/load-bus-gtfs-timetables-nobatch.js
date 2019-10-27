const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
let gtfsNumberMapping = require('./gtfs-number-map')

const calendar = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/calendar.txt`).toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/calendar_dates.txt`).toString())
const trips = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/trips.txt`).toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync(`gtfs/${global.gtfsNumber}/stop_times.txt`).toString())

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({}, async err => {
  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'bus',
    headsign => null, routeGTFSID => true, !preserve)

  await updateStats(gtfsNumberMapping[gtfsNumber] + '-gtfs-timetables', tripsCount, new Date() - start)
  console.log('Completed loading in ' + tripsCount + ' bus trips')
  process.exit()
})
