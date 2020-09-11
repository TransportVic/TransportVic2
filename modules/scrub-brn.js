const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let acn13Trips = await vlineTrips.findDocuments({ consist: 'BRN' }).toArray()

  await async.forEach(acn13Trips, async trip => {
    trip.consist.splice(trip.consist.indexOf('BRN'), 1)
    await vlineTrips.updateDocument({
      _id: trip._id
    }, {
      $set: {
        consist: trip.consist
      }
    })
  })

  console.log('Scrubbed BRN from', acn13Trips.length, 'trips')
  process.exit()
})
