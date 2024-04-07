const fs = require('fs')
const async = require('async')
const config = require('../../../config')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const network = require('./regional-bus-network')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let routes = database.getCollection('routes')

  let routeData = await async.reduce(network, {}, async (acc, region) => {
    let matchingRoutes = await routes.findDocuments({
      'routePath.path': {
        $geoWithin: {
          $geometry: region.geometry
        }
      },
      $or: [{
        routeNumber: {
          $ne: null
        }
      }, {
        routeName: / town /i
      }],
      $and: [{
        routeNumber: {
          $not: {
            $eq: "Goldrush"
          }
        },
      }, {
        routeNumber: {
          $not: /Schools/
        }
      }]
    }).toArray()

    if (!matchingRoutes.length) {
      matchingRoutes = await routes.findDocuments({
        'routePath.path': {
          $geoWithin: {
            $geometry: region.geometry
          }
        },
      }).toArray() // Open it up to all routes if nothing matched (will be town buses)
    }

    let regionName = region.properties.name.trim()
    let hasLiveTrack = regionName.startsWith('L-')
    if (hasLiveTrack) regionName = regionName.slice(2)

    acc[regionName] = matchingRoutes.map(route => {
      let routeNumber = route.routeNumber ? route.routeNumber.replace('_x', '') : "Town"

      return { routeGTFSID: route.routeGTFSID, routeNumber, liveTrack: hasLiveTrack }
    }).sort((a, b) => a.routeNumber.localeCompare(b.routeNumber))

    return acc
  })

  fs.writeFileSync(__dirname + '/../regional-with-track.json', JSON.stringify(routeData, null, 1))

  process.exit()
})
