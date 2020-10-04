const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const moment = require('moment')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 12

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: gtfsID })

  let totalCount = 0

  let timetableFiles = fs.readdirSync(path.join(__dirname, 'timetables'))

  await async.forEach(timetableFiles, async fileName => {
    let data = require(path.join(__dirname, 'timetables', fileName))
    totalCount += data.trips.length

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, data.trips, data.timings, data.days, data.dates)
  })

  await updateStats('shuttle-timetables', totalCount)
  console.log('Completed loading in ' + totalCount + ' shuttle bus timetables')
  process.exit()
})
