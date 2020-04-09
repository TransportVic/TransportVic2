const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')
// const updateStats = require('./utils/gtfs-stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables = null
let stops = null

let start = new Date()

database.connect({}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  stops = database.getCollection('stops')

  let stopIDs = await stops.distinct('_id')
  let stopCount = stopIDs.length

  let bayCount = 0

  await async.forEachOfLimit(stopIDs, 100, async (id, i) => {
    let stop = await stops.findDocument({ _id: id })

    stop.bays = await async.map(stop.bays, async bay => {
      bayCount++

      let services = await gtfsTimetables.aggregate([
        {
          $match: {
            mode: bay.mode,
            stopTimings: {
              $elemMatch: {
                stopGTFSID: bay.stopGTFSID,
                departureTime: {
                  $ne: null
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              routeGTFSID: "$routeGTFSID",
              routeNumber: "$routeNumber"
            }
          }
        }
      ]).toArray()

      let screenServices = await gtfsTimetables.aggregate([
        {
          $match: {
            mode: bay.mode,
            'stopTimings.stopGTFSID': bay.stopGTFSID
          }
        },
        {
          $group: {
            _id: {
              routeGTFSID: "$routeGTFSID",
              gtfsDirection: "$gtfsDirection",
              routeNumber: "$routeNumber"
            }
          }
        }
      ]).toArray()
      bay.screenServices = services.map(e => e._id)

      return bay
    })

    await stops.updateDocument({ _id: id }, {
      $set: stop
    })

    if (i % 500 === 0) {
      console.log('Completed ' + (i / stopCount * 100).toFixed(2) + '% of stops')
    }
  })

  // await updateStats('stop-services', stopIDs.length, new Date() - start)

  console.log('Completed loading in services for ' + stopIDs.length + ' stops and ' + bayCount + ' bays')
  process.exit()
})
