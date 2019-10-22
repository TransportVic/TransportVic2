const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const lr = require('../../line-reader')
const crypto = require('crypto')

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/4/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/4/calendar_dates.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let benchmarkStart = new Date()

// check flag exists
global.gc()

function shaHash(data) {
  let hash = crypto.createHash('sha1')
  hash.update(data)
  return parseInt(hash.digest('hex'), 16)
}

database.connect({
  poolSize: 400
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  gtfsTimetables.createIndex({
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

  await gtfsTimetables.deleteDocuments({mode: 'metro bus'})

  let loaded = 0
  let start = 0

  let iteration = 0

  let boundLoadBatch = (trips, tripTimesData) => loadGTFSTimetables(database, calendar, calendarDates, trips, tripTimesData, 'metro bus',
  headsign => null, routeGTFSID => true, false)

  async function loadBatch() {
    let lines = await lr.getLines('gtfs/4/trips.txt', 5000, start)
    let lineCount = lines.length
    if (!lineCount) return

    let trips = lines.filter(l => l.length > 2).join('\n')
    start += trips.length + 1

    if (iteration !== 0)
      trips = '.\r\n' + trips.trim()

    lines = null
    global.gc()

    trips = utils.parseGTFSData(trips)
    let tripIDs = trips.map(trip => shaHash(trip[2]))

    // console.log('read in trip data, reading timing data now - ' + rawTripTimesData.length + ' lines to check, ' + tripIDs.length + ' trips to match')
    console.log('read in trip data, reading timing data now ' + tripIDs.length + ' trips to match')
    let tstart = new Date()
    let tripTimingLines = await lr.getLinesFilter('gtfs/4/stop_times.txt', line => {
      let tripID = line.slice(1, line.indexOf('"', 2))

      return tripIDs.indexOf(shaHash(tripID)) !== -1 // indexOf faster than includes
    })
    console.log('read ' + tripTimingLines.length + ' lines of timing data, parsing data now - took ' + (new Date() - tstart) / 1000 + 's')
    let tripTimesData = tripTimingLines.map(line => {
      return line.match(/"([^"]*)"/g).map(f => f.slice(1, -1))
    })
    tripTimingLines = null
    global.gc()

    console.log('parsed data, loading it in now')
    tripIDs = null
    loaded += await boundLoadBatch(trips, tripTimesData)

    trips = null
    tripTimesData = null

    console.log('completed 5000 lines: iteration ' + ++iteration)

    global.gc()
    return await loadBatch()
  }

  await loadBatch()

  await updateStats('mbus-gtfs-timetables', loaded, new Date() - benchmarkStart)
  console.log('Completed loading in ' + loaded + ' metro bus trips')
  process.exit()
})
