const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config')
const utils = require('../utils')
const async = require('async')

const updateStats = require('../load-gtfs/utils/stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let start = new Date()

database.connect({}, async err => {
  let routes = database.getCollection('routes')
  let stops = database.getCollection('stops')

  let regionalBusRoutes = await routes.findDocuments({
    routeGTFSID: /6-/
  }).toArray()

  let stopCache = {}

  await async.forEachOfSeries(regionalBusRoutes, async (busRoute, i) => {
    let routeStops = busRoute.directions[0].stops
    let stopsBySuburbs = {}

    await async.forEach(routeStops, async stop => {
      let {stopGTFSID, suburb} = stop

      if (!stopsBySuburbs[suburb])
        stopsBySuburbs[suburb] = 0

      stopsBySuburbs[suburb]++
    })

    let pairs = Object.keys(stopsBySuburbs).map(suburb => [suburb, stopsBySuburbs[suburb]])
    let best = pairs.sort((a, b) => {
      return b[1] - a[1] || a[0].localeCompare(b[0])
    })[0]

    await routes.updateDocument({
      routeGTFSID: busRoute.routeGTFSID
    }, {
      $set: {
        suburb: best[0],
        cleanSuburbs: utils.encodeName(best[0])
      }
    })

    if (i % 30 === 0 && i !== 0) console.log(`Route-Suburbs: Completed ${i} routes`)
  })

  await updateStats('regional-bus-suburbs', regionalBusRoutes.length)
  console.log('Completed loading in ' + regionalBusRoutes.length + ' route suburbs')
  process.exit()
})
