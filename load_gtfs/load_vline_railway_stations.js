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
  vlineRailwayStations.createIndex({ stationLocation: '2dsphere', stationName: 1 })

  const allStations = stopsData.split('\r\n').slice(1).filter(Boolean).map(e => {
    const values = e.split(',').map(f => f.slice(1, -1))

    const stationNameData = values[1].match(/([^(]+) \((.+)+\)/)

    return {
      gtfsStationID: values[0],
      stationName: stationNameData[1],
      stationSuburb: stationNameData[2],
      stationCodeName: stationNameData[1].slice(0, -16).toLowerCase().replace(/  */g, '-'),
      stationLocation: {
        type: 'MultiPoint',
        coordinates: [
          [values[3] * 1, values[2] * 1]
        ]
      }
    }
  })

  await async.map(allStations, async station => {
    if (await vlineRailwayStations.countDocuments({ stationName: station.stationName })) {
      await vlineRailwayStations.updateDocument({ stationName: station.stationName }, {
        $set: station
      })
    } else {
      await vlineRailwayStations.createDocument(station)
    }
  })

  console.log('Completed loading in ' + allStations.length + ' V/Line railway stations')
  process.exit()
})
