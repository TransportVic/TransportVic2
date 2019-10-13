const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
const stopsData = utils.parseGTFSData(fs.readFileSync('gtfs/4/stops.txt').toString())
const datamartStops = require('../../spatial-datamart/metro-bus-stops.json').features

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
    'bays.stopGTFSID': 1,
    'bays.mode': 1
  }, {unique: true})

  let stopsLookup = createStopsLookup(datamartStops)
  let stopCount = await loadStops(stopsData, stops, 'metro bus', stopsLookup, stopName => {
    if (stopName === 'Monash University') return 'Monash University Bus Loop'
    if (stopName.includes('Chadstone SC- ')) return 'Chadstone SC/Eastern Access Rd'
    return stopName
  })

  console.log('Completed loading in ' + stopCount + ' metro bus stops')
  process.exit()
});
