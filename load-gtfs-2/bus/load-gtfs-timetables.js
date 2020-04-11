const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const datamartModes = require('../datamart-modes')

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

  let calendarDays = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar.txt')).toString())
  let calendarDates = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())

  let tripFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trips'))
  let tripTimeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('trip-times'))

  let tripCount = 0

  await async.forEachOfSeries(tripFiles, async (tripFile, index) => {
    let trips = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripFile)))
    let tripTimings = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, tripTimeFiles[index])))

    tripCount += trips.length

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, trips, tripTimings,
      calendarDays, calendarDates, null, (routeGTFSID, gtfsDirection, stopTimings, routeNumber) => {
        if (routeGTFSID === '6-921') { // Mildura 100/200
          return ['200', '100'][gtfsDirection]
        }
        if (routeGTFSID === '6-20b') { // Mildura 211/311/312
          if (gtfsDirection === '0') { // Milura - Merbein
            let stops = stopTimings.map(e => e.stopName)
            if (stops.includes('Mildura Central SC/Fifteenth St')) {
              return '311' // 311 via Mildura Central SC
            } else {
              return '312' // 312 direct to Mildura Station
            }
          } else { // Merbein - Mildura
            return '211'
          }
        }
        if (routeGTFSID === '6-920') { // Mildura 250/300
          return ['300', '250'][gtfsDirection]
        }
        if (routeGTFSID === '6-946') { //Swan Hill Schools AM
          return 'AM'
        }
        if (routeGTFSID === '6-949') { //Swan Hill Schools PM
          return 'PM'
        }
        if (routeGTFSID === '6-a28') { // Swan Hill - Tooleybuc
          return null
        }
        if (['6-WN1', '6-WN2', '6-WN3'].includes(routeGTFSID)) {
          // Wallan 1, 2 and 3
          return routeGTFSID.slice(-1)
        }
        if (routeGTFSID === '6-BM8') { // Barmah 8
          return 8
        }
        if (['6-906', '6-907', '6-908'].includes(routeGTFSID)) {
          return routeGTFSID.slice(2)
        }
        if (['6-a84', '6-a49', '6-R54'].includes(routeGTFSID)) {
          // Wonthaggi North, South and to Dudley
          return null
        }
        if (routeGTFSID === '6-gld') {
          return 'GOLD'
        }

        return routeNumber
      }, routeGTFSID => {
        // Swan Hill AM and PM
        if (['6-946', '6-949'].includes(routeGTFSID)) return 'School Bus'
        return null
      })

    console.log(`GTFS Timetables: Completed iteration ${index + 1} of ${tripFiles.length}, loaded ${trips.length} trips`)
  })

  await updateStats(datamartMode + '-timetables', tripCount)
  console.log(`Completed loading in ${tripCount} ${datamartMode} trips`)
  console.log(`Took: ${utils.uptime()}ms`)
  process.exit()
})
