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
const turf = require('@turf/turf')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 2

let rceLoc = [
  144.906903825601,
  -37.7877304563777
]

let city = turf.polygon([[
  [144.946408, -37.8134578],
  [144.9513433, -37.8232552],
  [144.9768779, -37.8164412],
  [144.9722002, -37.8061003],
  [144.946408, -37.8134578]
]])

function pointsClose(a, b) {
  return utils.getDistanceFromLatLon(a[1], a[0], b[1], b[0]) < 100
}

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

  let rce
  if (rce = await routes.findDocument({ routeGTFSID: "2-ain" })) {
    let rceLength = flemington.routePath[0].length
    let rceDown = flemington.routePath[0].path
    let rceUp = flemington.routePath[0].path.slice(0).reverse()

    rce.routePath.forEach(path => {
      let points = path.path
      let start = points[0], end = points[points.length - 1]
      let startPoint = turf.point(start)
      let endPoint = turf.point(end)

      if (pointsClose(start, rceLoc) && turf.booleanWithin(endPoint, city)) { // UP
        path.path = rceUp
        path.length = rceLoc
      } else if (turf.booleanWithin(startPoint, city) && pointsClose(end, rceLoc)) {
        path.path = rceDown
        path.length = rceLength
      }
    })

    await routes.replaceDocument({ routeGTFSID: "2-ain" }, rce)
  } else {
    await routes.replaceDocument({ routeGTFSID: "2-ain" }, flemington, { upsert: true })
  }

  await updateStats('mtm-routes', routeData.length + 2)
  console.log('Completed loading in ' + routeData.length + 2 + ' MTM rail routes')
  process.exit()
})
