const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadRoutes = require('../utils/load-routes')
const routeData = utils.parseGTFSData(fs.readFileSync('gtfs/4/routes.txt').toString())
const shapeData = utils.parseGTFSData(fs.readFileSync('gtfs/4/shapes.txt').toString())
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let routes = null

database.connect({
  poolSize: 100
}, async err => {
  routes = database.getCollection('routes')
  routes.createIndex({
    routeName: 1,
    routeGTFSID: 1
  }, {unique: true})

  function adjustRouteName(routeName) {
    let loopPostfix = ''
    if (routeName.toLowerCase().includes('clockwise')) {
      routeName = routeName.replace(/\(?(?:anti)? ?-? ?(?:clockwise)(?: loop)?\)?$/i, '')
      let hasAnti = routeName.toLowerCase().includes('anti')
      loopPostfix = ' ('
      if (hasAnti) loopPostfix += 'Anti-'
      loopPostfix += 'Clockwise Loop)'
    }

    routeName = routeName.replace(/via .+/, '')
      .replace(/ \(SMARTBUS.+/g, '')
      .replace(/  +/g, '')
      .replace(/(\w) *- *(\w)/g, '$1 - $2')
      .replace(/Railway Station/g, 'Station')
      .replace(/Station/g, 'Railway Station')
      .trim()

    return routeName + loopPostfix
  }

  let ptvRoutes = (await ptvAPI('/v3/routes?route_types=2')).routes
  ptvRoutes = ptvRoutes.filter(route => {
    return route.route_gtfs_id.startsWith('4-')
  }).reduce((acc, route) => {
    acc[route.route_gtfs_id] = adjustRouteName(route.route_name)
    return acc
  }, {})
console.log(ptvRoutes)
  let routeCount = await loadRoutes(routeData, shapeData, routes, () => ['Operator'], 'metro bus', (_, routeGTFSID) => {
    return ptvRoutes[routeGTFSID]
  })

  console.log('Completed loading in ' + routeCount + ' metro bus routes')
  process.exit()
});
