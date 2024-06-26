const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 10

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: gtfsID })

  let splicedGTFSPath = path.join(__dirname, `../spliced-gtfs-stuff/${gtfsID}`)
  let gtfsPath = path.join(__dirname, `../../gtfs/${gtfsID}`)

  let calendarDays = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar.txt')).toString())
  let calendarDates = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())

  let tripFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trips'))
  let tripTimeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trip-times'))

  let tripCount = 0

  await async.forEachOfSeries(tripFiles, async (tripFile, index) => {
    let trips = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripFile)))
    let tripTimings = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripTimeFiles[index])))

    trips = trips.map(trip => {
      let times = tripTimings.find(times => times.tripID === trip.tripID)
      let departureTime = times.stopTimings[0].departureTime
      let arrivalTime = times.stopTimings.slice(-1)[0].arrivalTime

      if (trip.headsign === 'Melbourne') { // AM trip
        if (departureTime === '08:15:00') trip.runID = '1AM8'
        if (departureTime === '07:25:00') trip.runID = '5AM8'
      } else { // MA trip
        if (arrivalTime === '18:30:00') trip.runID = '2MA8'
        if (arrivalTime === '18:35:00') trip.runID = '6MA8'
      }

      return trip
    })

    tripCount += trips.length

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, trips, tripTimings, calendarDays, calendarDates, (headsign, routeGTFSID) => {
      return headsign === 'Melbourne' ? 'Up' : 'Down'
    })

    console.log(`GTFS Timetables: Completed iteration ${index + 1} of ${tripFiles.length}, loaded ${trips.length} trips`)
  })

  await updateStats('overland-timetables', tripCount)
  console.log('Completed loading in ' + tripCount + ' Overland trips')
  process.exit()
})
