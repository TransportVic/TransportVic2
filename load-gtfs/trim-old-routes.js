const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('./utils/stats')

async function deleteRoute(routeGTFSID, gtfsTimetables, routes) {
  await Promise.all([
    routes.deleteDocument({ routeGTFSID }),
    gtfsTimetables.deleteDocuments({ routeGTFSID })
  ])

  console.log('Deleted route ' + routeGTFSID + ' as it was past the until date')
}

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let gtfsTimetables = database.getCollection('gtfs timetables')

  let untilRoutes = await routes.findDocuments({
    'operationDate.type': 'until'
  }).toArray()

  let now = utils.now()

  let passed = untilRoutes.filter(route => {
    return route.operationDate.operationDate < now
  })

  await async.forEach(passed, async route => {
    deleteRoute(route.routeGTFSID, gtfsTimetables, routes)
  })

  await updateStats('trim-old-routes', passed.length)
  console.log('Deleted ' + passed.length + ' old bus routes')
  process.exit(0)
})
