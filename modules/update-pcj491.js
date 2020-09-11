const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let acn13Trips = await vlineTrips.findDocuments({ consist: 'BCZ260' }).toArray()

  await async.forEach(acn13Trips, async trip => {
    trip.consist[trip.consist.indexOf('BCZ260')] = 'PCJ491'

    await vlineTrips.updateDocument({
      _id: trip._id
    }, {
      $set: {
        consist: trip.consist
      }
    })
  })

  console.log('Updated BCZ260 to PCJ491 in', acn13Trips.length, 'trips')
  process.exit()
})
