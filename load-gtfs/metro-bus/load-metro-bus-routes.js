const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadRoutes = require('../utils/load-routes')
const routeData = utils.parseGTFSData(fs.readFileSync('gtfs/4/routes.txt').toString())
const shapeData = utils.parseGTFSData(fs.readFileSync('gtfs/4/shapes.txt').toString())

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

  let routeCount = await loadRoutes(routeData, shapeData, routes, () => ['Operator'], 'metro bus')

  console.log('Completed loading in ' + routeCount + ' metro bus routes')
  process.exit()
});
