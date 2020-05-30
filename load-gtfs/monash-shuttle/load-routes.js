/*
Route guide;
12-MCC.H: clayton - caulfield
12-MCC.R: caulfield - clayton
12-MCP.H: clayton - peninsula
12-MCP.R: peninsula - clayton
12-MPF.H: frankston - peninsula
12-MPF.R: peninsula - frankston
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

let gtfsID = '12'

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = utils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data', 'routes.txt')).toString())

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return ['Quinces']
  })

  await updateStats('monash-shuttles', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' monash shuttles')
  process.exit()
})
