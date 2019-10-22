const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
const stopsData = utils.parseGTFSData(fs.readFileSync('gtfs/1/stops.txt').toString())
const datamartStops = require('../../spatial-datamart/vline-train-stations.json').features

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()
let stops = null

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')

  let stopsLookup = createStopsLookup(datamartStops)
  let stopCount = await loadStops(stopsData, stops, 'regional train', stopsLookup)

  await updateStats('vline-stations', stopCount, new Date() - start)
  console.log('Completed loading in ' + stopCount + ' V/Line railway stations')
  process.exit()
});
