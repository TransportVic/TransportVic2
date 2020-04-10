const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadRoutes = require('../utils/load-routes')
const utils = require('../../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 5

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)

  let routeData = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    await loadRoutes(routes, gtfsID, routeData, shapeJSON, () => {
      return ['V/Line']
    }, null)
  })

  await updateStats('coach-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' regional coach routes')
  process.exit()
})
