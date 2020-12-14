const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadRoutes = require('../utils/load-routes')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const cityCircle = require('../../additional-data/city-circle')
const flemington = require('../../additional-data/flemington-racecourse')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 2

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)

  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    await loadRoutes(routes, gtfsID, routeData, shapeJSON, () => {
      return ['Metro Trains Melbourne']
    }, (shortRouteName, _, routeGTFSID) => {
      if (routeGTFSID === '2-ain') return 'Showgrounds/Flemington'
      return shortRouteName
    })
  })

  await routes.replaceDocument({ routeGTFSID: "2-CCL" }, cityCircle, { upsert: true })
  await routes.replaceDocument({ routeGTFSID: "2-ain" }, flemington, { upsert: true })

  await updateStats('mtm-routes', routeData.length + 1)
  console.log('Completed loading in ' + routeData.length + 1 + ' MTM rail routes')
  process.exit()
})
