const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const loadRoutes = require('../utils/load-routes')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 10

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let splicedGTFSPath = path.join(__dirname, `../spliced-gtfs-stuff/${gtfsID}`)
  let gtfsPath = path.join(__dirname, `../../gtfs/${gtfsID}`)

  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    await loadRoutes(routes, gtfsID, routeData, shapeJSON, () => {
      return ['Journey Beyond Rail']
    }, (routeNumber, routeName, routeGTFSID) => {
      return 'The Overland'
    })
  })

  await updateStats('overland-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' Overland rail routes')
  process.exit()
})
