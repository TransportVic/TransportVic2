const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')
const carriages = require('../additional-data/carriage-sets')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let broken = await vlineTrips.findDocuments({
    'consist.3': {
      $exists:false
    },
    consist: /N/
  }).toArray()

  let fixed = 0

  await async.forEach(broken, async trip => {
    let loco = trip.consist.find(x => x.startsWith('N'))
    let powervan = trip.consist.find(x => x.startsWith('P'))
    let consist = trip.consist.find(x => !x.startsWith('P')&&!x.startsWith('N'))
    if (carriages[consist + '_']) {
      fixed++

      let fullConsist = [loco, ...carriages[consist], powervan].filter(Boolean)

      await vlineTrips.updateDocument({
        _id: trip._id
      }, {
        $set: {
          consist: fullConsist
        }
      })
      console.log(trip.consist, fullConsist.join(', '))
    } else {
      console.log('couldnt confirm', trip.consist)
    }

  })

  console.log('Fixed', fixed, 'broken trips')
  process.exit()
})
