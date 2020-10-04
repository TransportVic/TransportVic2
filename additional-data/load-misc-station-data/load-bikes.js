const fs = require('fs')
const async = require('async')
const carparkData = require('./bikes')
const config = require('../../config')
const DatabaseConnection = require('../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let stops = database.getCollection('stops')

  let stationData = {}

  await async.forEach(carparkData.features, async feature => {
    let capacity = feature.properties.CAPACITY
    let type = feature.properties.TYPE
    let location = feature.properties.LOCATION
    let geometry = feature.geometry

    let stop = await stops.findDocument({
      location: {
        $nearSphere: {
          $geometry: geometry,
          $maxDistance: 200
        }
      },
      'bays.mode': {
        $in: ['metro train', 'regional train']
      }
    })

    if (!stop) {
      stop = await stops.findDocument({
        location: {
          $nearSphere: {
            $geometry: geometry,
            $maxDistance: 500
          }
        },
        'bays.mode': {
          $in: ['metro train', 'regional train']
        }
      })
    }

    let station = stop.stopName.slice(0, -16)

    if (!stationData[station]) stationData[station] = []
    stationData[station].push({
      capacity, type, location, geometry
    })
  })

  fs.writeFileSync(__dirname + '/../station-bikes.json', JSON.stringify(stationData, null, 0))
  process.exit()
})
