const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const BufferedLineReader = require('../divide-and-conquer/BufferedLineReader')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const moment = require('moment')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 14

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: gtfsID })

  let totalCount = 0

  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)
  let calendarDays = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar.txt')).toString())
  let calendarDates = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())

  let chars = ['A', 'B', 'C', 'D']
  let tripsLineReader = new BufferedLineReader(path.join(gtfsPath, 'trips.txt'))
  let tripTimingsLineReader = new BufferedLineReader(path.join(gtfsPath, 'stop_times.txt'))
  await tripsLineReader.open()
  await tripTimingsLineReader.open()

  let tripsConsidered = []
  let rawTripIDsConsidered = []
  let mappedTripIDsConsidered = []

  while (tripsLineReader.available()) {
    let line = await tripsLineReader.nextLine()
    let lineData = gtfsUtils.splitLine(line)
    let routeID = lineData[0]

    if (routeID.startsWith('4T.T.ST')) {
      let rawShapeID = lineData[7]
      let variant = rawShapeID.split('.').slice(-2).join('.')
      let rawTripID = lineData[2]

      let routeGTFSID = '14-XPT'
      let shapeID = `14-XPT-${chars[routeID[8] - 1]}-mjp-1.${variant}`
      let calendarID = lineData[1]
      let tripID = `${rawTripID.slice(-4)}.${calendarID}.14-XPT`
      let gtfsDirection = lineData[5]
      let headsign = lineData[3]

      rawTripIDsConsidered.push(rawTripID)
      mappedTripIDsConsidered.push(tripID)

      tripsConsidered.push({
        mode: 'regional train',
        tripID,
        routeGTFSID,
        calendarID,
        gtfsDirection,
        shapeID,
        headsign,
        runID: rawTripID.slice(0, 4)
      })
    }
  }

  console.log('Filtered trips, found', tripsConsidered.length)

  let tripTimes = []
  let currentTripID = null
  let currentTrip = []

  while (tripTimingsLineReader.available()) {
    let line = await tripTimingsLineReader.nextLine()
    let lineData = gtfsUtils.splitLine(line)
    let rawTripID = lineData[0]

    let tripIDIndex = rawTripIDsConsidered.indexOf(rawTripID)
    if (tripIDIndex !== -1) {
      let tripID = mappedTripIDsConsidered[tripIDIndex]

      if (currentTripID && currentTripID !== tripID) {
        tripTimingsLineReader.unreadLine()
        tripTimes.push({
          tripID: currentTripID,
          stopTimings: currentTrip
        })
        currentTrip = []
      } else {
        currentTrip.push({
          stopGTFSID: parseInt(lineData[3].replace('P', '0')) + 140000000,
          arrivalTime: lineData[1],
          departureTime: lineData[2],
          stopConditions: {
            pickup: parseInt(lineData[5]),
            dropoff: parseInt(lineData[6])
          },
          stopDistance: parseFloat(lineData[9]),
          stopSequence: parseFloat(lineData[4])
        })
      }

      currentTripID = tripID
    }
  }

  tripTimes.push({
    tripID: currentTripID,
    stopTimings: currentTrip
  })

  console.log('Filtered trip times')

  await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, tripsConsidered, tripTimes, calendarDays, calendarDates, (headsign, routeGTFSID) => {
    return headsign === 'Central' ? 'Down' : 'Up'
  })

  await updateStats('xpt-timetables', tripsConsidered.length)
  console.log('Completed loading in ' + tripsConsidered.length + ' xpt timetables')
  process.exit()
})
