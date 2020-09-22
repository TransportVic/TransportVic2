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
      let variant = shapeID.split('.').slice(-2).join('.')
      let routeGTFSID = '14-XPT'
      let newShapeID = `14-XPT-${chars[shapeID[8] - 1]}-mpj-1.${variant}`

      if (currentShapeID && currentShapeID !== newShapeID) {
        shapesLineReader.unreadLine()
        shapes.push({
          newShapeID: currentShapeID,
          routeGTFSID: currentRouteGTFSID,
          path: currentShape,
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
    path: currentShape,
    length: currentLength
  })

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return ['NSW TrainLink']
  })

  await updateStats('xpt-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' xpt routes')
  process.exit()
})
