const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const fs = require('fs')
const stopsData = fs.readFileSync('gtfs/1/google_transit/stops.txt').toString()
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let vlineRailwayStations = null

database.connect({
  poolSize: 100
}, async err => {
  vlineRailwayStations = database.getCollection('vline railway stations')
  vlineRailwayStations.createIndex({ location: '2dsphere', name: 1, gtfsID: 1 })

  const allStations = stopsData.split('\r\n').slice(1).filter(Boolean).map(e => {
    const values = e.split(',').map(f => f.slice(1, -1))

    const stationNameData = values[1].match(/([^(]+) \((.+)+\)/)

    return {
      gtfsID: values[0],
      name: stationNameData[1],
      suburb: stationNameData[2],
      codeName: stationNameData[1].slice(0, -16).toLowerCase().replace(/  */g, '-'),
      location: {
        type: 'MultiPoint',
        coordinates: [
          [values[3] * 1, values[2] * 1]
        ]
      }
    }
  })

  await async.map(allStations, async station => {
    if (await vlineRailwayStations.countDocuments({ name: station.name })) {
      await vlineRailwayStations.updateDocument({ name: station.name }, {
        $set: station
      })
    } else {
      await vlineRailwayStations.createDocument(station)
    }
  })

  console.log('Completed loading in ' + allStations.length + ' V/Line railway stations')
  process.exit()
})
