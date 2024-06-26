/*
Route guide;
13-PBR Puffing Billy
13-BPR Bellarine Railway
13-DCR Daylesford Country Railway
*/

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
    path: data.coordinates,
    length: turf.length(data, { units: 'kilometers' }) * 1000
  }
})

let gtfsID = 13

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data', 'routes.txt')).toString())

  await loadRoutes(routes, gtfsID, routeData, shapes, () => {
    return ['Heritage']
  })

  await updateStats('heritage-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' heritage rail routes')
  process.exit()
})
