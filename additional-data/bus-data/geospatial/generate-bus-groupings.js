const fs = require('fs')
const async = require('async')
const config = require('../../../config')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const network = require('./regional-bus-network')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let routes = database.getCollection('routes')
  await async.forEachSeries(network, async region => {
    let routeNumbers = await routes.distinct('routeNumber', {
      'routePath.path': {
        $geoWithin: {
          $geometry: region.geometry
        }
      },
      routeNumber: {
        $ne: null
      }
    })

    console.log(region.properties.name, routeNumbers.sort((a,b) => a - b))
  })

  process.exit()
})
