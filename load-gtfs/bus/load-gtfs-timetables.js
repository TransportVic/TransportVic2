const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const datamartModes = require('../datamart-modes')
const gtfsUtils = require('../../gtfs-utils')
const determineBusRouteNumber = require('../../additional-data/determine-bus-route-number')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = process.argv[2]
let datamartMode = datamartModes[gtfsID]

if (gtfsID === '7') datamartMode = 'telebus'

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: parseInt(gtfsID) })

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)

  let calendarDays = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar.txt')).toString())
  let calendarDates = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())

  let tripFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trips'))
  let tripTimeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trip-times'))

  let tripCount = 0

  await async.forEachOfSeries(tripFiles, async (tripFile, index) => {
    let trips = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripFile)))
    let tripTimings = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripTimeFiles[index])))

    tripCount += trips.length

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, trips, tripTimings,
      calendarDays, calendarDates, null, determineBusRouteNumber, routeGTFSID => {
        // Swan Hill AM and PM
        if (['6-946', '6-949'].includes(routeGTFSID)) return 'School Bus'

        // Wallan Link A, B
        if (['6-W12', '6-WN3'].includes(routeGTFSID)) return 'Link Bus'

        return null
      })

    console.log(`GTFS Timetables: Completed iteration ${index + 1} of ${tripFiles.length}, loaded ${trips.length} trips`)
  })

  await updateStats(datamartMode + '-timetables', tripCount)
  console.log(`Completed loading in ${tripCount} ${datamartMode} trips`)
  console.log(`Took: ${utils.uptime()}ms`)
  process.exit()
})
