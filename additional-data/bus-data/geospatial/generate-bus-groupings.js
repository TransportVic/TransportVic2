const fs = require('fs')
const async = require('async')
const config = require('../../../config')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const path = require('path')
const operators = require('../../../transportvic-data/excel/bus/operators/regional-numbered-operators.json')

const network = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../transportvic-data/geospatial/regional-bus-networks/bus-network-regions.geojson')))

const database = new DatabaseConnection(config.databaseURL, config.gtfsDatabaseName)

database.connect(async () => {
  let routes = database.getCollection('routes')

  let routeData = await async.reduce(network.features, {}, async (acc, region) => {
    let matchingRoutes = await routes.findDocuments({
      mode: 'bus',
      'routePath.path': {
        $geoWithin: {
          $geometry: region.geometry
        }
      },
      // routeNumber: {
      //   $ne: null
      // },
      $and: [{
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

    if (regionName === 'Warragul') matchingRoutes = matchingRoutes.filter(route => route.routeNumber)
    if (regionName === 'Glenrowan') matchingRoutes = matchingRoutes.filter(route => route.routeNumber === 'H46')

    let regionOperators = operators[regionName]

    let regionRoutes = matchingRoutes.map(route => {
      let routeNumber = route.routeNumber ? route.routeNumber.replace('_x', '') : "Town"

      return { routeGTFSID: route.routeGTFSID, routeNumber, liveTrack: hasLiveTrack }
    }).sort((a, b) => a.routeNumber.localeCompare(b.routeNumber))

    acc[regionName] = regionRoutes

    for (let route of regionRoutes) {
      if (!regionOperators || !regionOperators[route.routeNumber]) {
        console.log('Could not match regional operators', regionName, route)
        continue
      }
      await routes.updateDocument({ routeGTFSID: route.routeGTFSID }, {
        $set: {
          operators: [ regionOperators[route.routeNumber] ]
        }
      })
    }

    return acc
  })

  fs.writeFileSync(__dirname + '/../regional-with-track.json', JSON.stringify(routeData, null, 1))

  process.exit()
})
