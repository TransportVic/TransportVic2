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
const ptvAPI = require('../../ptv-api')
const loopDirections = require('../../additional-data/loop-direction')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = process.argv[2]
let datamartMode = datamartModes[gtfsID]

const datamartRoutes = require(`../../spatial-datamart/${datamartMode}-route.json`).features
let serviceLookup = createServiceLookup(datamartRoutes)

if (gtfsID === '7') datamartMode = 'telebus'

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let ptvRoutes = (await ptvAPI('/v3/routes?route_types=2')).routes
  ptvRoutes = ptvRoutes.filter(route => {
    return route.route_gtfs_id.startsWith(`${gtfsID}-`)
  }).reduce((acc, route) => {
    let adjusted = utils.adjustRouteName(route.route_name)

    acc[route.route_gtfs_id.replace(/-0+/, '-')] = adjusted
    return acc
  }, {})

  ptvRoutes['4-676'] = 'Lilydale East Loop'

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)

  let routeData = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    await loadRoutes(routes, gtfsID, routeData, shapeJSON, (routeGTFSID, routeNumber, routeName) => {
      if (serviceLookup[routeGTFSID]) return serviceLookup[routeGTFSID].operator
      if (operatorOverrides[routeGTFSID]) return operatorOverrides[routeGTFSID]

      let routeMatch = Object.values(serviceLookup).find(route => {
        return routeName === route.routeName && routeNumber === route.routeNumber
      })
      if (routeMatch) return routeMatch.operator

      console.log(`Could not map operator for ${routeGTFSID}: ${routeNumber} ${routeName}`)

      return ['Unknown Operator']
    }, (routeNumber, routeName, routeGTFSID) => {
      let newRouteName = ptvRoutes[routeGTFSID] || routeName
      if (loopDirections[routeGTFSID]) {
        if (newRouteName.includes('Loop')) {
          if (!loopDirections[routeGTFSID][1])
            newRouteName += ` (${loopDirections[routeGTFSID][0]})`
        } else {
          if (loopDirections[routeGTFSID][1])
            newRouteName += ' (Loop)'
          else
            newRouteName += ` (${loopDirections[routeGTFSID][0]} Loop)`
        }
      }
      return newRouteName
    }, (routeGTFSID, routeNumber) => {
      if (routeGTFSID === '6-GVL') return null
      return routeNumber
    })
  })

  await updateStats(datamartMode + '-routes', routeData.length)
  console.log(`Completed loading in ${routeData.length} ${datamartMode} bus routes`)
  process.exit()
})
