const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadRoutes = require('../utils/load_routes')
const routeData = utils.parseGTFSData(fs.readFileSync('gtfs/5/routes.txt').toString())
const shapeData = utils.parseGTFSData(fs.readFileSync('gtfs/5/shapes.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let routes = null

database.connect({
  poolSize: 100
}, async err => {
  routes = database.getCollection('routes')
  routes.createIndex({ routeName: 1 }, {unique: true})

  let routeCount = await loadRoutes(routeData, shapeData, routes, () => ['V/Line'], 'regional coach', name => {
    if (name.match(/ - Melbourne/)) {
      name = 'Melbourne - ' + name.replace(' - Melbourne', '')
    }
    return name
  })

  console.log('Completed loading in ' + routeCount + ' V/Line coach routes')
  process.exit()
});
