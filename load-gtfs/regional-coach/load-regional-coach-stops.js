const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const async = require('async')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
const stopsData = utils.parseGTFSData(fs.readFileSync('gtfs/5/stops.txt').toString())
const datamartStops = require('../../spatial-datamart/regional-coach-stops.json').features

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')

  let stopsLookup = createStopsLookup(datamartStops)
  let stopCount = await loadStops(stopsData, stops, 'regional coach', stopsLookup)

  let allVlineStations = await stops.findDocuments({
    bays: {
      $elemMatch: {
        mode: 'regional train'
      }
    }
  }).toArray()

  await async.forEach(allVlineStations, async station => {
    let hasCoachStop = station.bays.filter(bay => {
      return bay.mode === 'regional coach' && bay.fullStopName.endsWith('Railway Station')
    }).length !== 0
    let stationPlatform = station.bays.filter(bay => bay.mode === 'regional train')[0]

    if (!hasCoachStop && station.stopName !== 'Southern Cross Railway Station') {
      let coachStop = JSON.parse(JSON.stringify(stationPlatform))
      coachStop.mode = 'regional coach'
      station.bays.push(coachStop)
      await stops.updateDocument({ _id: station._id }, {
        $set: station
      })
      stopCount++
    }
  })

  console.log('Completed loading in ' + stopCount + ' V/Line coach stops')
  process.exit()
});
