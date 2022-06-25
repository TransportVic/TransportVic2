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

let gtfsID = 5
let excludedRoutes = ['5-Vov', '5-Vpk']

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let splicedGTFSPath = path.join(__dirname, `../spliced-gtfs-stuff/${gtfsID}`)
  let gtfsPath = path.join(__dirname, `../../gtfs/${gtfsID}`)

  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  let routeShapesSeen = []
  let allRoutes = routeData.map(r => gtfsUtils.simplifyRouteGTFSID(r[0])).filter((e, i, a) => a.indexOf(e) === i)

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    shapeJSON = shapeJSON.filter(shape => {
      return !excludedRoutes.includes(shape.routeGTFSID)
    })

    routeShapesSeen = routeShapesSeen.concat(
      await loadRoutes(routes, gtfsID, routeData, shapeJSON, () => {
        return ['V/Line']
      }, null)
    )
  })

  await async.forEachSeries(allRoutes, async routeGTFSID => {
    if (!routeShapesSeen.includes(routeGTFSID)) {
      if (excludedRoutes.includes(routeGTFSID)) return

      console.log('Found that', routeGTFSID, 'does not have a route shape programmed in, giving it a default one')

      await loadRoutes(routes, gtfsID, routeData, [{
        shapeID: "",
        routeGTFSID: routeGTFSID,
        path: [[ 144, -38 ]],
        length: 1
      }], () => {
        return ['V/Line']
      }, null)

      routeShapesSeen.push(routeGTFSID)
    }
  })

  await updateStats('coach-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' regional coach routes')
  process.exit()
})
