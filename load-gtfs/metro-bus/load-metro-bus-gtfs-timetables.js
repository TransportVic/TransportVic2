const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const lr = require('../../line-reader')
const crypto = require('crypto')

function shaHash(data) {
  let hash = crypto.createHash('sha1')
  hash.update(data)
  return parseInt(hash.digest('hex').slice(0, 5), 16)
}

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/4/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/4/calendar_dates.txt').toString())
let start = new Date()
const rawTripTimesData = fs.readFileSync('gtfs/4/stop_times.txt').toString().split('\r\n').map(line => {
  let tripID = line.slice(1, line.indexOf('"', 2))

  return [shaHash(tripID), line]
})
console.log('Completed loading trip timing lines - took ' + (new Date() - start) / 1000 + 's')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')

// check flag exists
global.gc()

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
    let lines = await lr.getLines('gtfs/4/trips.txt', 7500, start)
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

    console.log('read in trip data, reading timing data now - ' + rawTripTimesData.length + ' lines to check, ' + tripIDs.length + ' trips to match')
    let tstart = new Date()
    let tripTimingLines = rawTripTimesData.filter((line, i) => {
      if (i % 100000 == 0)
        console.log('LineReader: read in ' + i + ' lines')

      return tripIDs.indexOf(line[0]) !== -1 // indexOf faster than includes
    })
    console.log('read ' + tripTimingLines.length + ' lines of timing data, parsing data now - took ' + (new Date() - tstart) / 1000 + 's')
    let tripTimesData = tripTimingLines.map(line => {
      return line[1].match(/"([^"]*)"/g).map(f => f.slice(1, -1))
    })
    console.log('parsed data, loading it in now')

    tripIDs = null
    loaded += await boundLoadBatch(trips, tripTimesData)

    trips = null
    tripTimesData = null
    tripTimingLines = null

    console.log('completed 7500 lines: iteration ' + ++iteration)

    global.gc()
    return await loadBatch()
  }

  await loadBatch()

  //60946
  console.log('Completed loading in ' + loaded + ' metro bus trips')
  process.exit()
})
