const async = require('async')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config')
const utils = require('../../../utils')
const termini = require('../../../additional-data/termini-to-lines')

const updateStats = require('../../utils/stats')

let stops, gtfsTimetables

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let mode = {
  $in: ['regional train', 'regional coach']
}

function getShortRouteName(trip) {
  let origin = trip.origin.slice(0, -16)
  let destination = trip.destination.slice(0, -16)
  let originDest = `${origin}-${destination}`

  return termini[originDest] || termini[origin] || termini[destination]
}

async function findDownConnections(origin, destination) {
  let trips = await gtfsTimetables.findDocuments({
    mode: 'regional coach',
    origin,
    destination
  }).toArray()

  let connectionsMade = 0

  await async.forEachLimit(trips, 50, async trip => {
    let stop = trip.stopTimings.slice(-1)[0]
    let validTimes = {
      $gte: stop.arrivalTimeMinutes + 1,
      $lte: stop.arrivalTimeMinutes + 20
    }

    let connection = await gtfsTimetables.findDocuments({
      mode: 'regional train',
      operationDays: trip.operationDays[0],
      stopTimings: { // Seems like some trips still programmed as originating from SSS
        $elemMatch: {
          stopName: destination,
          departureTimeMinutes: validTimes
        }
      },
      direction: 'Down'
    }).sort({ 'stopTimings.0.departureTimeMinutes': 1 }).limit(1).next()

    if (connection) {
      connectionsMade++

      await gtfsTimetables.updateDocument({
        _id: trip._id
      }, {
        $set: {
          trainConnection: connection.routeName,
          connections: [{
            operationDays: [trip.operationDays[0]],
            changeAt: destination,
            for: connection.destination,
            tripID: connection.tripID
          }]
        }
      })
    }
  })

  console.log(`Found ${connectionsMade} connections matching ${origin}-${destination}`)

  return connectionsMade
}

async function findUpConnections(origin, destination) {
  let trips = await gtfsTimetables.findDocuments({
    mode: 'regional train',
    stopTimings: {
      $elemMatch: {
        stopName: origin // Deals with trips that arent correctly adjusted to end at the destination
      }
    },
    direction: 'Up'
  }).toArray()

  let connectionsMade = 0

  await async.forEachLimit(trips, 50, async trip => {
    let stop = trip.stopTimings.find(s => s.stopName === origin)
    let validTimes = {
      $gte: stop.arrivalTimeMinutes + 1,
      $lte: stop.arrivalTimeMinutes + 20
    }

    let connection = await gtfsTimetables.findDocuments({
      mode: 'regional coach',
      operationDays: trip.operationDays[0], // Disruptions programmed on individual days so this only captures the relevant trip
      origin,
      destination,
      'stopTimings.0.departureTimeMinutes': validTimes
    }).sort({ 'stopTimings.0.departureTimeMinutes': 1 }).limit(1).next() // Because these trips were not updated their times might not match the coach, so we pick the cloest one available

    if (connection) {
      connectionsMade++

      await gtfsTimetables.updateDocument({
        _id: connection._id
      }, {
        $set: {
          trainConnection: trip.routeName
        }
      })

      await gtfsTimetables.updateDocument({
        _id: trip._id
      }, {
        $set: {
          connections: [{
            operationDays: [trip.operationDays[0]],
            changeAt: origin,
            for: destination,
            tripID: connection.tripID
          }]
        }
      })
    }
  })

  console.log(`Found ${connectionsMade} connections matching ${origin}-${destination}`)

  return connectionsMade
}

database.connect({
  poolSize: 100
}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  stops = database.getCollection('stops')

  let count = 0

  count += await findDownConnections('Southern Cross Coach Terminal/Spencer Street', 'Sunshine Railway Station')
  count += await findUpConnections('Sunshine Railway Station', 'Southern Cross Coach Terminal/Spencer Street')
  count += await findDownConnections('Southern Cross Coach Terminal/Spencer Street', 'Gisborne Railway Station')
  count += await findUpConnections('Gisborne Railway Station', 'Southern Cross Coach Terminal/Spencer Street')

  updateStats('vline-coach-replacement-connections', count)
  console.log('Completed loading in ' + count + ' vline connections')
  process.exit()
})
