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
      routeNumber: {
        $ne: null
      }
    }).toArray()

    acc[region.properties.name.trim()] = matchingRoutes.map(route => {
      return { routeGTFSID: route.routeGTFSID, routeNumber: route.routeNumber }
    }).sort((a, b) => parseInt(a.routeNumber) - parseInt(b.routeNumber))

    return acc
  })

  fs.writeFileSync(__dirname + '/../regional-with-track.json', JSON.stringify(routeData, null, 1))

  process.exit()
})
