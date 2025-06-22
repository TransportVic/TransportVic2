import fs from 'fs/promises'
import async from 'async'
import config from '../../config.json' with { type: 'json' }
import DatabaseConnection from '../../database/DatabaseConnection.js'
import operators from '../../transportvic-data/excel/bus/operators/regional-numbered-operators.json' with { type: 'json' }
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const network = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/regional-bus-networks/bus-network-regions.geojson')))

const database = new DatabaseConnection(config.databaseURL, config.gtfsDatabaseName)

await database.connect({})
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

await fs.writeFile(path.join(__dirname, '../../additional-data/bus-data/regional-with-track.json'), JSON.stringify(routeData, null, 1))
process.exit()