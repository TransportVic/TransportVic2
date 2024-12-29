const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config')
const async = require('async')

const updateStats = require('./utils/stats')

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

      let screenServices = await gtfsTimetables.aggregate([
        {
          $match: {
            mode: bay.mode,
            stopTimings: {
              $elemMatch: {
                stopGTFSID: bay.stopGTFSID,
                departureTimeMinutes: {
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
              gtfsDirection: "$gtfsDirection",
              routeNumber: "$routeNumber"
            }
          }
        }
      ]).toArray()

      let services = await gtfsTimetables.aggregate([
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

      bay.services = services.map(e => e._id)
      bay.screenServices = screenServices.map(e => e._id)

      return bay
    })

    await stops.updateDocument({ _id: id }, {
      $set: stop
    })

    if (i % 2000 === 0) {
      console.log('Stop Services: Completed ' + (i / stopCount * 100).toFixed(2) + '% of stops')
    }
  })

  await updateStats('stop-services', stopIDs.length)
  console.log('Completed loading in services for ' + stopIDs.length + ' stops and ' + bayCount + ' bays')
  process.exit()
})
