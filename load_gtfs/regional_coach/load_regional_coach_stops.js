const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadStops = require('../utils/load_stops')
const stopsData = utils.parseGTFSData(fs.readFileSync('gtfs/5/stops.txt').toString())

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

  let stopCount = await loadStops(stopsData, stops, 'regional coach')

  console.log('Completed loading in ' + stopCount + ' V/Line coach stops')
  process.exit()
});
