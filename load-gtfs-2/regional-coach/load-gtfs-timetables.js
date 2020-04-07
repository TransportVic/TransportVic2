const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../../load-gtfs/utils/gtfs-stats')

let gtfsID = 5

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: gtfsID })

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)

  let calendarDays = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar.txt')).toString())
  let calendarDates = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())

  let tripFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trips'))
  let tripTimeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trip-times'))

  let tripCount = 0

  await async.forEachOfSeries(tripFiles, async (tripFile, index) => {
    let trips = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripFile)))
    let tripTimings = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripTimeFiles[index])))

    tripCount += trips.length

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, trips, tripTimings, calendarDays, calendarDates, null)

    console.log(`GTFS Timetables: Completed iteration ${index + 1} of ${tripFiles.length}, loaded ${trips.length} trips`)
  })

  // await updateStats('mtm-stations', stopCount, new Date() - start)
  console.log('Completed loading in ' + tripCount + ' regional coach trips')
  process.exit()
})
