const async = require('async')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')

const updateStats = require('../../utils/stats')

let gtfsTimetables

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let mode = {
  $in: ['regional train', 'regional coach']
}

async function findConnections(changeoverPoint) {
  let shorts = await gtfsTimetables.findDocuments({
    mode,
    'stopTimings.stopName': changeoverPoint
  }).toArray()

  let connectionsMade = 0

  await async.forEachLimit(shorts, 50, async trip => {
    let stop = trip.stopTimings.find(stop => stop.stopName === changeoverPoint)
    let validTimes = []
    for (let i = 1; i <= 15; i++) {
      validTimes.push(stop.arrivalTimeMinutes + i)
    }

    for (let operationDay of trip.operationDays) {
      let connection = await gtfsTimetables.findDocument({
        mode,
        operationDays: operationDay,
        stopTimings: {
          $elemMatch: {
            stopName: changeoverPoint,
            $or: [{
              departureTimeMinutes: {
                $in: validTimes
              }
            }, {
              arrivalTimeMinutes: {
                $in: validTimes
              }
            }]
          }
        },
        destination: {
          $not: {
            $eq: trip.destination
          }
        }
      })

      if (connection) {
        connectionsMade++
        if (!trip.connections) trip.connections = []

        if (!trip.connections.find(c => c.tripID === connection.tripID)) {
          trip.connections.push({
            operationDay,
            changeAt: changeoverPoint,
            for: connection.destination,
            from: trip.destination,
            tripID: connection.tripID
          })

          await gtfsTimetables.updateDocument({
            _id: trip._id
          }, {
            $set: {
              connections: trip.connections
            }
          })
        }
      }
    }
  })

  console.log('Found ' + connectionsMade + ' connections at ' + changeoverPoint)

  return connectionsMade
}

database.connect({
  poolSize: 100
}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')

  let count = 0

  count += await findConnections('Koo Wee Rup Bus Interchange/Rossiter Road')

  updateStats('vline-connections', count)
  console.log('Completed loading in ' + count + ' vline connections')
  process.exit()
})
