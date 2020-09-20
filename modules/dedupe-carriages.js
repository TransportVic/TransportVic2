const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')
const carriages = require('../additional-data/carriage-sets')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let broken = await vlineTrips.findDocuments({
    consist: /VL/,
    'consist.2': /VL/
  }).toArray()

  await async.forEach(broken, async trip => {
    await vlineTrips.updateDocument({
      _id: trip._id
    }, {
      $set: {
        consist: trip.consist.filter((e, i, a) => a.indexOf(e) === i), // Simple deduper
      }
    })
  })

  console.log('Fixed', broken.length, 'broken trips')
  process.exit()
})
