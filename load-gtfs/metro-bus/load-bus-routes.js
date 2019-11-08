const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadRoutes = require('../utils/load-routes')
let gtfsNumber = process.argv[2]
let gtfsNumberMapping = require('./gtfs-number-map')
const { createServiceLookup } = require('../utils/datamart-utils')
let datamartName = gtfsNumberMapping[gtfsNumber]
if (datamartName === 'telebus') datamartName = 'metro-bus'
let datamartRoutes = []
try {
  datamartRoutes = require(`../../spatial-datamart/${datamartName}-route.json`).features
} catch (e) {}
const operatorOverrides = require('./operator-overrides')
let defaultOperator = process.argv[3]

const routeData = utils.parseGTFSData(fs.readFileSync(`gtfs/${gtfsNumber}/routes.txt`).toString())
const shapeData = utils.parseGTFSData(fs.readFileSync(`gtfs/${gtfsNumber}/shapes.txt`).toString())
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let routes = null
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  routes = database.getCollection('routes')

  let routesLookup = createServiceLookup(datamartRoutes)

  let ptvRoutes = (await ptvAPI('/v3/routes?route_types=2')).routes
  ptvRoutes = ptvRoutes.filter(route => {
    return route.route_gtfs_id.startsWith(`${gtfsNumber}-`)
  }).reduce((acc, route) => {
    acc[route.route_gtfs_id] = utils.adjustRouteName(route.route_name)
    return acc
  }, {})

  let routeCount = await loadRoutes(routeData, shapeData, routes, (routeName, routeGTFSID, routeNumber) => {
    if (operatorOverrides[routeGTFSID]) return operatorOverrides[routeGTFSID]
    if (routesLookup[routeGTFSID]) return routesLookup[routeGTFSID].operator

    let matches = Object.values(routesLookup).filter(route => {
      return routeName === route.routeName && routeNumber === route.routeNumber
    })
    if (matches.length) return matches[0].operator

    if (!defaultOperator) {
      console.log('Could not map operator for route ' + routeGTFSID + ': ' + routeNumber + ' ' + routeName)
      return ["Unknown operator"]
    }
    return [defaultOperator]
  }, 'bus', (_, routeGTFSID) => {
    return ptvRoutes[routeGTFSID] || _
  })

  await updateStats(gtfsNumberMapping[gtfsNumber] + '-routes', routeCount, new Date() - start)
  console.log('Completed loading in ' + routeCount + ' bus routes')
  process.exit()
});
