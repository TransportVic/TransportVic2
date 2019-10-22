const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadRoutes = require('../utils/load-routes')
const routeData = utils.parseGTFSData(fs.readFileSync('gtfs/5/routes.txt').toString())
const shapeData = utils.parseGTFSData(fs.readFileSync('gtfs/5/shapes.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()
let routes = null

database.connect({
  poolSize: 100
}, async err => {
  routes = database.getCollection('routes')
  routes.createIndex({
    routeName: 1,
    routeGTFSID: 1
  }, {unique: true})

  let routeCount = await loadRoutes(routeData, shapeData, routes, () => ['V/Line'], 'regional coach', name => {
    if (name.match(/ - Melbourne/)) {
      name = 'Melbourne - ' + name.replace(' - Melbourne', '')
    }

    if (name.includes('Melbourne')) {
      let shortName = name.replace('Melbourne - ', '').replace(/\/\w+/, '').replace(/ Via .+/, '')

      return [name, shortName]
    } else return name
  })

  await updateStats('coach-routes', routeCount, new Date() - start)
  console.log('Completed loading in ' + routeCount + ' V/Line coach routes')
  process.exit()
});
