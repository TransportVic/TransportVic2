const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const loadStops = require('../utils/load-stops')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let stopsData = require('./data/stops')

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')
  await loadStops(stops, stopsData, {})

  await updateStats('ferry-terminals', stopsData.length)
  console.log('Completed loading in ' + stopsData.length + ' Ferry terminals')
  process.exit()
})
