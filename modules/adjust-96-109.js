const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect({}, async () => {
  let tramTrips = database.getCollection('tram trips')
  let _96 = await tramTrips.findDocuments({
    date: {
      $in: ['20201002', '20201003', '20201004']
    },
    routeNumber: /96/
  }).toArray()

  let _109 = await tramTrips.findDocuments({
    date: '20201005',
    routeNumber: '109a'
  }).toArray()

  await async.forEach(_96, async trip => {
    if (trip.origin === 'Belford Street/Acland Street') {
      trip.origin = 'Clarendon Street Junction/Whiteman Street'
    }
    if (trip.destination === 'Belford Street/Acland Street') {
      trip.destination = 'Clarendon Street Junction/79 Whiteman Street'
    }

    await tramTrips.replaceDocument({_id: trip._id}, trip)
  })

  await async.forEach(_109, async trip => {
    if (trip.origin === 'Beacon Cove/Light Rail') {
      trip.origin = 'Clarendon Street Junction/Whiteman Street'
    }
    if (trip.destination === 'Beacon Cove/Light Rail') {
      trip.destination = 'Clarendon Street Junction/79 Whiteman Street'
    }

    await tramTrips.replaceDocument({_id: trip._id}, trip)
  })

  process.exit()
})
