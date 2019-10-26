const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/2/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/2/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/2/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/2/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  let tripsCount = await loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'metro train', (headsign, routeGTFSID) => {
    return (headsign.includes('flinders street') || (routeGTFSID === '2-SPT' && headsign === 'frankston')) ? 'Up': 'Down'
  }, routeGTFSID => true)

  await updateStats('mtm-gtfs-timetables', tripsCount, new Date() - start)
  console.log('Completed loading in ' + tripsCount + ' MTM trips')
  process.exit()
})
