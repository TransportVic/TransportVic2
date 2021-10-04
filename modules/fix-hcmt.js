const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const getDepartures = require('../modules/metro-trains/get-departures')
const schedule = require('./trackers/scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = []

database.connect(async () => {
  let liveTimetables = database.getCollection('live timetables')
  let start = utils.now().startOf('day')

  let hcmt = await liveTimetables.findDocuments({
    h: true
  }).toArray()

  await async.forEach(hcmt, async trip => {
    if ([trip.origin, trip.destination].includes('Cranbourne Railway Station')) {
      trip.routeGTFSID = '2-CRB'
      trip.routeName = 'Cranbourne'
      await liveTimetables.replaceDocument({ _id: trip._id }, trip)
    }
  })
  process.exit()
})
