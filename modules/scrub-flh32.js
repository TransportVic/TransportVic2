const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let flh32 = await vlineTrips.findDocuments({ consist: 'FLH32' }).toArray()

  await async.forEach(flh32, async trip => {
    trip.consist.splice(trip.consist.indexOf('FLH32'), 1)
    await vlineTrips.updateDocument({
      _id: trip._id
    }, {
      $set: {
        consist: trip.consist
      }
    })
  })

  console.log('Scrubbed FLH32 from', flh32.length, 'trips')
  process.exit()
})
