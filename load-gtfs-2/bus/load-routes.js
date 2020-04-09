const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadRoutes = require('../utils/load-routes')
const { createServiceLookup } = require('../utils/datamart-utils')
const utils = require('../../utils')
const datamartModes = require('../datamart-modes')
const operatorOverrides = require('../../additional-data/operator-overrides')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../../load-gtfs/utils/gtfs-stats')

let gtfsID = process.argv[2]
let datamartMode = datamartModes[gtfsID]

const datamartRoutes = require(`../../spatial-datamart/${datamartMode}-route.json`).features
let serviceLookup = createServiceLookup(datamartRoutes)

if (gtfsID === '7') datamartMode = 'telebus'

let start = new Date()

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
    await loadRoutes(routes, gtfsID, routeData, shapeJSON, (routeGTFSID, routeNumber, routeName) => {
      if (serviceLookup[routeGTFSID]) return serviceLookup[routeGTFSID].operator
      if (operatorOverrides[routeGTFSID]) return operatorOverrides[routeGTFSID]

      console.log(`Could not map operator for ${routeGTFSID}: ${routeNumber} ${routeName}`)

      return ['Unknown Operator']
    }, null)
  })

  // await updateStats('mtm-stations', stopCount, new Date() - start)
  console.log(`Completed loading in ${routeData.length} ${datamartMode} bus routes`)
  process.exit()
})
