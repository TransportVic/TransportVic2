/*
Route guide;
14-XPT.H Sydney - Melbourne
14-XPT.R Melbourne - Sydney

Filter as 4T.T.ST trains (ST21-24)
*/

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
  let shapesLineReader = new BufferedLineReader(path.join(__dirname, '../../gtfs/14/stop_times.txt'))
  let stopsLineReader = new BufferedLineReader(path.join(__dirname, '../../gtfs/14/stops.txt'))
  await shapesLineReader.open()
  await stopsLineReader.open()
  let seen = []
  while (shapesLineReader.available()) {
    let line = await shapesLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let shapeID = line[0]
    if (shapeID.startsWith('ST')) {
      let stopid = line[3]
      if (!seen.includes(stopid)) seen.push(stopid)
    }
  }

let stn =[]
  while (stopsLineReader.available()) {
    let line = await stopsLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let stopid = line[0]
    if (seen.includes(stopid)) {
      let stopname = line[1].replace(/Plat.+/, '').trim()
      if (!stn.includes(stopname)) stn.push(stopname)
    }
  }
  console.log(JSON.stringify(stn, null, 1))

  shapes.push({
    shapeID: currentShapeID,
    routeGTFSID: currentRouteGTFSID,
    path: currentShape,
    length: currentLength
  })

  await loadRoutes(routes, gtfsID, routeData, shapes, (routeGTFSID) => {
    return ['Sydney Trains']
  })

  await updateStats('xpt-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' xpt routes')
  process.exit()
})
