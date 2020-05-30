/*
Route guide;
9-STY-A.H: sty - french island - sty
9-STY.B.H: sty - french island - phillip island - french island - sty
9-PMW.H: port melb - spotswood
9-PMW.R: spotswood - port melb
9-PPO.H: Docklands - Portarlington
9-PPO.R: Portarlington - Docklands
9-PGL.H: Docklands - Geelong
9-PGL.R: Geelong - Docklands
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

let gtfsID = '9'

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = utils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data', 'routes.txt')).toString())

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    if (['9-PPO', '9-PGL'].includes(routeGTFSID)) {
      return ['Port Phillip Ferries']
    } else if (routeGTFSID === '9-STY') {
      return ['Western Port Ferries']
    } else if (routeGTFSID === '9-PMW') {
      return ['Westgate Punt']
    }
  })

  await updateStats('ferry-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' ferry routes')
  process.exit()
})