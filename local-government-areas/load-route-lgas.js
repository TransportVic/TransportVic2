const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')

const updateStats = require('../load-gtfs/utils/stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let start = new Date()

database.connect({}, async err => {
  let lgas = database.getCollection('lgas')
  let routes = database.getCollection('routes')
  let stops = database.getCollection('stops')

  let regionalBusRoutes = await routes.findDocuments({
    routeGTFSID: /6-/
  }).toArray()

  let stopCache = {}

  await async.forEachOfSeries(regionalBusRoutes, async (busRoute, i) => {
    let routeStops = busRoute.directions[0].stops
    let stopsByLGAs = {}

    await async.forEach(routeStops, async stop => {
      let {stopGTFSID} = stop
      let stopLGAs
      if (stopCache[stopGTFSID])
        stopLGAs = stopCache[stopGTFSID]
      else {
        let stopData = await stops.findDocument({ 'bays.stopGTFSID': stopGTFSID })

        let {location} = stopData

        stopLGAs = await lgas.distinct('name', {
          geometry: {
            $geoIntersects: {
              $geometry: location
            }
          }
        })
        stopCache[stopGTFSID] = stopLGAs
      }

      stopLGAs.forEach(stopLGA => {
        if (!stopsByLGAs[stopLGA])
          stopsByLGAs[stopLGA] = 0

        stopsByLGAs[stopLGA]++
      })
    })

    let pairs = Object.keys(stopsByLGAs).map(lga => [lga, stopsByLGAs[lga]])
    let best = pairs.sort((a, b) => {
      return b[1] - a[1] || a[0].localeCompare(b[0])
    })[0]

    await routes.updateDocument({
      routeGTFSID: busRoute.routeGTFSID
    }, {
      $set: {
        lgaID: best[0]
      }
    })

    if (i % 20 === 0 && i !== 0) console.log(`Route-LGAs: Completed ${i} routes`)
  })

  await updateStats('regional-bus-lgas', regionalBusRoutes.length)

  console.log('Completed loading in ' + regionalBusRoutes.length + ' route LGAs')
  process.exit()
})
