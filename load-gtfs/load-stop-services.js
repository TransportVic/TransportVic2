const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')
const updateStats = require('./utils/gtfs-stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables = null
let stops = null

let start = new Date()

database.connect({}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  stops = database.getCollection('stops')

  let stopIDs = await stops.distinct('_id')
  let stopCount = stopIDs.length

  await async.forEachOfLimit(stopIDs, 100, async (stopID, i) => {
    let routeGTFSIDs = await gtfsTimetables.distinct('routeGTFSID', {
      'stopTimings.stopID': stopID
    })
    await stops.updateDocument({ _id: stopID }, {
      $set: {
        services: routeGTFSIDs
      }
    })
    if (i % 50000) {
      console.log('Completed ' + (i / stopCount * 100).toFixed(2) + '% of stops')
    }
  })

  await updateStats('stop-services', stopIDs.length, new Date() - start)

  console.log('Completed loading in services for ' + stopIDs.length + ' stops')
  process.exit()
})
