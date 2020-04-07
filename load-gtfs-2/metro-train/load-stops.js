const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
const datamartStops = require('../../spatial-datamart/metro-train-stations.json').features
let stopsLookup = createStopsLookup(datamartStops)

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../../load-gtfs/utils/gtfs-stats')

let gtfsID = 2

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let stopsFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('stops'))

  let stopCount = 0

  await async.forEachSeries(stopsFiles, async stopFile => {
    let data = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, stopFile)))
    await loadStops(stops, data, stopsLookup)
    stopCount += data.length
  })

  // await updateStats('mtm-stations', stopCount, new Date() - start)
  console.log('Completed loading in ' + stopCount + ' MTM railway stations')
  process.exit()
})
