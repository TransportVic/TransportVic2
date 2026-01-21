const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const BufferedLineReader = require('../split-gtfs/BufferedLineReader')
const config = require('../../config')
const loadRoutes = require('../utils/load-routes')
const gtfsUtils = require('../../gtfs-utils')
const utils = require('../../utils.mjs')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 14

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(__dirname, 'data/routes.txt')).toString())

  let shapesLineReader = new BufferedLineReader(path.join(__dirname, '../../gtfs/14/shapes.txt'))
  await shapesLineReader.open()
  let chars = ['A', 'B', 'C', 'D']

  let shapes = []
  let routesSeen = []

  let currentShapeID = null
  let currentRouteGTFSID = null
  let currentShape = []
  let currentLength = null

  while (shapesLineReader.available()) {
    let line = await shapesLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let shapeID = line[0]
    if (shapeID.startsWith('4T.T.ST')) {
      let routeGTFSID = '14-XPT'
      let newShapeID = `14-XPT-${chars[shapeID[8] - 1]}-mjp-1.1.${shapeID.slice(-1).toUpperCase()}`

      if (currentShapeID && currentShapeID !== newShapeID) {
        shapesLineReader.unreadLine()
        shapes.push({
          shapeID: currentShapeID,
          routeGTFSID: currentRouteGTFSID,
          path: {
            type: "LineString",
            coordinates: currentShape
          },
          length: currentLength
        })
        currentShape = []
      } else {
        let newLength = parseFloat(line[4])
        if (currentLength === newLength) continue
        currentLength = newLength

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
    path: {
      type: "LineString",
      coordinates: currentShape
    },
    length: currentLength
  })

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return ['NSW TrainLink']
  })

  await updateStats('xpt-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' xpt routes')
  process.exit()
})
