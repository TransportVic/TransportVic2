/*
Route guide;

12-MCC.H: caulfield - clayton
12-MCC.R: clayton - caulfield
12-MCP.H: clayton - peninsula
12-MCP.R: peninsula - clayton
12-MPF.H: frankston - peninsula
12-MPF.R: peninsula - frankston

12-PNS-A.H: Quarantine Station - Fort Nepean
12-PNS-A.R: Fort Nepean - Quarantine Station
12-PNS-B.H: Front Entrance - Fort Nepean
12-PNS-B.R: Fort Nepean - Front Entrance
i.e: A - Quarantine Station, B - Front Entrance
*/

let routeOperators = {
  '12-MCC': 'Quinces',
  '12-MCP': 'Quinces',
  '12-MPF': 'Quinces',

  '12-PNS': 'Ventura Bus Lines'
}

const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const loadRoutes = require('../utils/load-routes')
const utils = require('../../utils')
const turf = require('@turf/turf')
const gtfsUtils = require('../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let shapeMap = require('./shapes/shape-map')

let shapes = Object.keys(shapeMap).map(shapeID => {
  let fileName = shapeMap[shapeID] + '.json'
  let data = JSON.parse(fs.readFileSync(path.join(__dirname, 'shapes', fileName)))
  return {
    shapeID,
    routeGTFSID: shapeID.slice(0, 6),
    path: data,
    length: turf.length(data, { units: 'kilometers' }) * 1000
  }
})

let gtfsID = 12

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data', 'routes.txt')).toString())

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return [routeOperators[routeGTFSID]]
  })

  await updateStats('shuttle-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' shuttles routes')
  process.exit()
})
