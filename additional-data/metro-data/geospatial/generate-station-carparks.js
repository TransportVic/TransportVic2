const fs = require('fs')
const path = require('path')
const utils = require('../../../utils.mjs')
const async = require('async')
const { closest, distance } = require('fastest-levenshtein')
const config = require('../../../config')
const DatabaseConnection = require('../../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let carparkJSON = JSON.parse(fs.readFileSync(process.argv[2]).toString())
let output = {}

database.connect(async () => {
  let stops = database.getCollection('stops')
  let allTrainStations = (await stops.distinct('stopName', {
    'bays.mode': {
      $in: ['metro train', 'regional train']
    }
  })).map(station => station.slice(0, -16))

  await async.forEachSeries(carparkJSON.features, async carpark => {
    let station = utils.expandStopName(carpark.properties.STATION).replace(/ Sidings?/, '')
    let capacity = carpark.properties.COM_CAPAC
    let geometry = carpark.geometry
    let matchedStationName

    if (station) {
      let closestName = closest(station, allTrainStations)
      if (closestName !== station && distance(closestName, station) >= 3) station = null
      else station = closestName
    }

    if (!station) {
      let firstStop = geometry.coordinates[0][0]
      if (geometry.type === 'MultiPolygon') firstStop = firstStop[0]

      let closestStation = await stops.findDocument({
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: firstStop
            },
            $maxDistance: 400
          }
        },
        'bays.mode': {
          $in: ['metro train', 'regional train']
        }
      })

      if (closestStation) station = closestStation.stopName.slice(0, -16)
      else return console.log('Discarded bad carpark', require('util').inspect(carpark, { depth: null }))
    }

    if (!output[station]) output[station] = []
    output[station].push({
      capacity,
      geometry
    })
  })

  fs.writeFileSync(path.join(__dirname, 'station-carparks.json'), JSON.stringify(output))

  process.exit(0)
})
