const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const BufferedLineReader = require('../divide-and-conquer/BufferedLineReader')
const config = require('../../config.json')
const loadRoutes = require('../utils/load-routes')
const gtfsUtils = require('../../gtfs-utils')
const utils = require('../../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = '14'

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = utils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data/routes.txt')).toString())

  let shapesLineReader = new BufferedLineReader(path.join(__dirname, '../../gtfs/14/shapes.txt'))
  let routesLineReader = new BufferedLineReader(path.join(__dirname, '../../gtfs/14/routes.txt'))
  await shapesLineReader.open()
  await routesLineReader.open()
  let chars = ['A', 'B']

  let shapes = []
  let routesSeen = []

  let currentShapeID = null
  let currentRouteGTFSID = null
  let currentShape = []

  let routeIDsConsidered = []
  while (routesLineReader.available()) {
    let line = await routesLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let routeName = line[3]
    if (routeName.includes('Melbourne')) {
      routeIDsConsidered.push(line[0])
    }
  }

  while (shapesLineReader.available()) {
    let line = await shapesLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let shapeID = line[0]
    if (routeIDsConsidered.includes(shapeID)) {
      let routeGTFSID = '14-XPT'
      let newShapeID = `14-XPT-${chars[shapeID[5] - 1]}-mjp-1.1.${shapeID[6].toUpperCase()}`

      if (currentShapeID && currentShapeID !== newShapeID) {
        shapesLineReader.unreadLine()
        shapes.push({
          shapeID: currentShapeID,
          routeGTFSID: routeGTFSID,
          path: currentShape,
          length: currentShape.length
        })
        currentShape = []
      } else {
        if (!routesSeen.includes(currentRouteGTFSID)) routesSeen.push(currentRouteGTFSID)
        currentShape.push([
          parseFloat(line[2]),
          parseFloat(line[1])
        ])
      }
      currentShapeID = newShapeID
      currentRouteGTFSID = routeGTFSID
    }
  }

  shapes.push({
    shapeID: currentShapeID,
    routeGTFSID: currentRouteGTFSID,
    path: currentShape,
    length: currentShape.length
  })
  console.log(shapes)
  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return ['NSW TrainLink']
  })

  await updateStats('xpt-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' xpt routes')
  process.exit()
})
