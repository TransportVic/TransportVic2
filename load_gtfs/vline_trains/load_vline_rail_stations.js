const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadStops = require('../utils/load_stops')
const { createStopsLookup } = require('../utils/datamart_utils')
const stopsData = utils.parseGTFSData(fs.readFileSync('gtfs/1/stops.txt').toString())
const datamartStops = require('../../spatial_datamart/vline_train_stations.json').features

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')
  stops.createIndex({
    'bays.location': '2dsphere',
    stopName: 1,
    'bays.fullStopName': 1,
    'bays.stopGTFSID': 1
  }, {unique: true})

  let stopsLookup = createStopsLookup(datamartStops)
  let stopCount = await loadStops(stopsData, stops, 'regional train', stopsLookup)

  console.log('Completed loading in ' + stopCount + ' V/Line railway stations')
  process.exit()
});
