const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
let datamartStops = []
try {
  datamartStops = require('../../spatial-datamart/metro-train-stations.json').features
} catch (e) { console.log('Could not load spatial datamart, skipping') }
let stopsLookup = createStopsLookup(datamartStops)

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 2

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let stopsFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('stops'))

  let stopCount = 0

  let hasSeenRCE = false, hasSeenSGS = false

  await async.forEachSeries(stopsFiles, async stopFile => {
    let data = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, stopFile)))

    data.forEach(stop => {
      let baseName = stop.originalName.replace('Railway', '').replace('Station', '').trim()
      stop.fullStopName = baseName + ' Railway Station'
    })

    if (!hasSeenRCE) hasSeenRCE = data.some(stop => stop.fullStopName === 'Flemington Racecourse Railway Station')
    if (!hasSeenSGS) hasSeenSGS = data.some(stop => stop.fullStopName === 'Showgrounds Railway Station')
    await loadStops(stops, data, stopsLookup)
    stopCount += data.length
  })

  if (!hasSeenRCE) {
    await loadStops(stops, [{
      originalName: 'Flemington Racecourse Railway Station (Flemington)',
      fullStopName: 'Flemington Racecourse Railway Station',
      stopGTFSID: 20027,
      location: {
        type: 'Point',
        coordinates: [ 144.907588697812, -37.787201923265 ]
      },
      stopNumber: null,
      mode: 'metro train',
      suburb: 'Flemington'
    }], stopsLookup)
    stopCount++
  }

  if (!hasSeenSGS) {
    await loadStops(stops, [{
      originalName: 'Showgrounds Railway Station (Flemington)',
      fullStopName: 'Showgrounds Railway Station',
      stopGTFSID: 20028,
      location: {
        type: 'Point',
        coordinates: [ 144.914256890322, -37.7834721968038 ]
      },
      stopNumber: null,
      mode: 'metro train',
      suburb: 'Flemington'
    }], stopsLookup)
    stopCount++
  }

  await updateStats('mtm-stations', stopCount)
  console.log('Completed loading in ' + stopCount + ' MTM railway stations')
  process.exit()
})
