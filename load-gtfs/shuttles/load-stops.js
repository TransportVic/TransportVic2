/*
11844 is used for 788 connections
*/
const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadStops = require('../utils/load-stops')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let stopsData = require('./data/stops.json')

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')
  await loadStops(stops, stopsData, {})

  await updateStats('shuttle-stops', stopsData.length)
  console.log('Completed loading in ' + stopsData.length + ' shuttle bus stops')
  process.exit()
})
