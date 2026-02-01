const fs = require('fs')
const path = require('path')
const utils = require('../../../utils.mjs')
const async = require('async')
const config = require('../../../config')
const DatabaseConnection = require('../../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let bikesJSON = JSON.parse(fs.readFileSync(process.argv[2]).toString())
let output = {}

database.connect(async () => {
  let stops = database.getCollection('stops')

  await async.forEachSeries(bikesJSON.features, async bikeStorage => {
    let locationName = bikeStorage.properties.STATION
    let capacity = bikeStorage.properties.CAPACITY
    let type = bikeStorage.properties.TYPE
    let location = bikeStorage.properties.LOCATION
    let geometry = bikeStorage.geometry

    if (locationName.includes('Train Facility')) return console.log('Skipping bike storage for', locationName)

    let firstStop = geometry.coordinates

    let closestStation = await stops.findDocument({
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: firstStop
          },
          $maxDistance: 200
        }
      },
      'bays.mode': {
        $in: ['metro train', 'regional train']
      }
    })

    if (!closestStation) return console.log(bikeStorage);
    let station = closestStation.stopName.slice(0, -16)

    if (!output[station]) output[station] = []
    output[station].push({
      capacity,
      type,
      location,
      geometry
    })
  })

  fs.writeFileSync(path.join(__dirname, 'station-bikes.json'), JSON.stringify(output))

  process.exit(0)
})
