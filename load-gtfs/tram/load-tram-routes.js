const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadRoutes = require('../utils/load-routes')

const routeData = utils.parseGTFSData(fs.readFileSync('gtfs/3/routes.txt').toString())
const shapeData = utils.parseGTFSData(fs.readFileSync('gtfs/3/shapes.txt').toString())
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let routes = null
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  routes = database.getCollection('routes')

  let routeCount = await loadRoutes(routeData, shapeData, routes, () => ['Yarra Trams'], 'tram')

  await updateStats('tram-routes', routeCount, new Date() - start)
  console.log('Completed loading in ' + routeCount + ' tram routes')
  process.exit()
});
