const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')

const fixTripDestination = require('../../modules/metro-trains/fix-trip-destinations')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 2

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')

  let tripIDs = await gtfsTimetables.distinct('_id', { mode: 'metro train' })
  let tripCount = tripIDs.length

  await async.forEachOfLimit(tripIDs, 1000, async (id, i) => {
    let trip = await gtfsTimetables.findDocument({ _id: id })

    await gtfsTimetables.replaceDocument({ _id: id }, fixTripDestination(trip))

    if (i % 2000 === 0) {
      console.log('Fix-Destinations: Completed ' + (i / tripCount * 100).toFixed(2) + '% of trips')
    }
  })

  await updateStats('fix-destinations', tripCount)
  console.log('Completed fixing ' + tripCount + ' MTM trips')
  process.exit()
})
