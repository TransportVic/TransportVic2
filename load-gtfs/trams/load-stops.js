const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
let datamartStops = []
try {
  datamartStops = require('../../spatial-datamart/metro-tram-stops').features
} catch (e) { console.log('Could not load spatial datamart, skipping') }
let stopsLookup = createStopsLookup(datamartStops)

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 3

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')

  let splicedGTFSPath = path.join(__dirname, `../spliced-gtfs-stuff/${gtfsID}`)
  let stopsFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('stops'))

  let stopCount = 0

  await async.forEachSeries(stopsFiles, async stopFile => {
    let data = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, stopFile)))
    await loadStops(stops, data, stopsLookup)
    stopCount += data.length
  })

  await updateStats('tram-stops', stopCount)
  console.log('Completed loading in ' + stopCount + ' tram stops')
  process.exit()
})
