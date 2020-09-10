/*
Route guide;
14-XPT.H Sydney - Melbourne
14-XPT.R Melbourne - Sydney
*/

const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadRoutes = require('../utils/load-routes')
const utils = require('../../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let shapes = require('./data/shapes.json')

let gtfsID = '14'

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = utils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data', 'routes.txt')).toString())

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return ['Sydney Trains']
  })

  await updateStats('xpt-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' xpt routes')
  process.exit()
})
