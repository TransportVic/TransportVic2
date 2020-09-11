const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let acn13Trips = await vlineTrips.findDocuments({ consist: 'B219' }).toArray()

  await async.forEach(acn13Trips, async trip => {
    trip.consist.splice(trip.consist.indexOf('B219'), 1)
    await vlineTrips.updateDocument({
      _id: trip._id
    }, {
      $set: {
        consist: trip.consist
      }
    })
  })

  console.log('Scrubbed B219 from', acn13Trips.length, 'trips')
  process.exit()
})
