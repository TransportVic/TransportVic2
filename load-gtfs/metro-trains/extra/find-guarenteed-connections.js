const async = require('async')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')

const updateStats = require('../../utils/stats')

let timetables

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function findConnections(changeoverPoint) {
  let shorts = await timetables.findDocuments({
    mode: 'metro train',
    'stopTimings.stopName': changeoverPoint
  }).toArray()

  let connectionsMade = 0

  await async.forEachLimit(shorts, 50, async trip => {
    let stop = trip.stopTimings.find(stop => stop.stopName === changeoverPoint)
    let validTimes = []
    for (let i = 2; i <= 7; i++) {
      validTimes.push((stop.arrivalTimeMinutes + i) % 1440)
    }

    let operationDay = trip.operationDays[0]

    let connection = await timetables.findDocument({
      mode: 'metro train',
      direction: trip.direction,
      operationDays: operationDay,
      origin: changeoverPoint,
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
      if (!trip.connections.find(c => c.runID === connection.runID)) {
        trip.connections.push({
          runID: connection.runID,
          changeAt: changeoverPoint,
          for: connection.destination,
          from: trip.destination
        })

        await timetables.updateDocument({
          _id: trip._id
        }, {
          $set: {
            connections: trip.connections
          }
        })
      }
    }
  })

  console.log('Found ' + connectionsMade + ' connections at ' + changeoverPoint)

  return connectionsMade
}

database.connect({
  poolSize: 100
}, async err => {
  timetables = database.getCollection('timetables')

  let count = 0

  count += await findConnections('Camberwell Railway Station')
  count += await findConnections('Ringwood Railway Station')
  count += await findConnections('Dandenong Railway Station')
  count += await findConnections('Frankston Railway Station')
  count += await findConnections('Newport Railway Station')

  updateStats('mtm-connections', count)
  console.log('Completed loading in ' + count + ' MTM connections')
  process.exit()
})
