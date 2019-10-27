const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
let gtfsNumber = process.argv[2]
let gtfsNumberMapping = require('./gtfs-number-map')

const stopsData = utils.parseGTFSData(fs.readFileSync(`gtfs/${gtfsNumber}/stops.txt`).toString())
const datamartStops = require(`../../spatial-datamart/${gtfsNumberMapping[gtfsNumber]}-stops.json`).features
const busStopNameModifier = require('./bus-stop-name-modifier')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = null
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')

  let stopsLookup = createStopsLookup(datamartStops)
  let stopCount = await loadStops(stopsData, stops, 'bus', stopsLookup, busStopNameModifier, stopGTFSID => {
    if (gtfsNumber === '8') return { isNightBus: true }
  })

  await updateStats(gtfsNumberMapping[gtfsNumber] + '-stops', stopCount, new Date() - start)
  console.log('Completed loading in ' + stopCount + ' bus stops')
  process.exit()
});
