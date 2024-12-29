const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config')
const utils = require('../../../utils')
const freeTramZoneGeofence = require('../../../additional-data/free-tram-zone-geofence')
const async = require('async')

const updateStats = require('../../utils/stats')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect({}, async () => {
  let stops = database.getCollection('stops')

  let ftzStops = await stops.findDocuments({
    'bays.location': {
      $geoWithin: {
        $geometry: freeTramZoneGeofence
      }
    },
    'bays.mode': 'tram'
  }).toArray()

  await async.forEach(ftzStops, async stop => {
    await stops.updateDocument({ _id: stop._id }, {
      $set: {
        bays: stop.bays.map(bay => {
          if (bay.mode === 'tram' && !bay.mykiZones.includes(0)) {
            bay.mykiZones.push(0)
          }
          bay.mykiZones.sort((a, b) => a - b)
          return bay
        })
      }
    })
  })

  await updateStats('free-tram-zone', ftzStops.length)
  console.log('Completed loading in ' + ftzStops.length + ' free tram zone stops')
  process.exit()
})
