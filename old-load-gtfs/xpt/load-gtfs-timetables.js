const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const BufferedLineReader = require('../split-gtfs/BufferedLineReader')
const config = require('../../config')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils.mjs')
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

  let gtfsPath = path.join(__dirname, `../../gtfs/${gtfsID}`)
  let calendarDays = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar.txt')).toString())
  let calendarDates = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())

  let tripsLineReader = new BufferedLineReader(path.join(gtfsPath, 'trips.txt'))
  let tripTimingsLineReader = new BufferedLineReader(path.join(gtfsPath, 'stop_times.txt'))
  await tripsLineReader.open()
  await tripTimingsLineReader.open()
  let chars = ['A', 'B', 'C', 'D']

  let tripsConsidered = []
  let rawTripIDsConsidered = []
  let mappedTripIDsConsidered = []

  while (tripsLineReader.available()) {
    let line = await tripsLineReader.nextLine()
    let lineData = gtfsUtils.splitLine(line)
    let rawTripID = lineData[2]

    if (rawTripID.startsWith('ST')) {
      let rawShapeID = lineData[7]
      let routeGTFSID = '14-XPT'
      let shapeID = `14-XPT-${chars[rawShapeID[8] - 1]}-mjp-1.1.${rawShapeID.slice(-1).toUpperCase()}`
      let calendarID = lineData[1]
      let tripID = `${rawTripID.slice(-4)}.${calendarID}.14-XPT`
      let gtfsDirection = lineData[5]
      let headsign = lineData[3]

      let carCount = rawTripID[rawTripID.indexOf('X.') + 2]

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
        runID: rawTripID.slice(0, 4),
        vehicle: `${carCount}x XPT`
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
          stopGTFSID: 'XPT' + lineData[3],
          arrivalTime: lineData[1],
          departureTime: lineData[2],
          stopConditions: {
            pickup: parseInt(lineData[6]),
            dropoff: parseInt(lineData[7])
          },
          stopDistance: parseFloat(lineData[10]),
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

  let sydneyBound = tripsConsidered.find(trip => trip.headsign === 'Central')
  let downCode = sydneyBound.tripID[sydneyBound.tripID.length - 1]

  await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, tripsConsidered, tripTimes, calendarDays, calendarDates, (headsign, routeGTFSID, tripID) => {
    return tripID[tripID.length - 1] === downCode ? 'Down' : 'Up'
  })

  await updateStats('xpt-timetables', tripsConsidered.length)
  console.log('Completed loading in ' + tripsConsidered.length + ' xpt timetables')
  process.exit()
})
