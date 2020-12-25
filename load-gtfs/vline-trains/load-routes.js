const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadRoutes = require('../utils/load-routes')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 1

let routeNames = {
  '1-V08': 'Bairnsdale',
  '1-Ech': 'Echuca',
  '1-V01': 'Albury',
  '1-V04': 'Ararat',
  '1-V05': 'Ballarat',
  '1-V12': 'Bendigo',
  '1-V23': 'Geelong',
  '1-my1': 'Maryborough',
  '1-Sht': 'Shepparton',
  '1-V45': 'Swan Hill',
  '1-V48': 'Traralgon',
  '1-V51': 'Warrnambool',
  '1-V40': 'Seymour',
  '1-Vov': 'Overland'
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
    shapeJSON = shapeJSON.filter(shape => {
      return shape.routeGTFSID !== '1-vPK'
    })
    await loadRoutes(routes, gtfsID, routeData, shapeJSON, () => {
      return ['V/Line']
    }, (routeNumber, routeName, routeGTFSID) => {
      return routeNames[routeGTFSID]
    })
  })

  await updateStats('vline-routes', routeData.length)
  console.log('Completed loading in ' + routeData.length + ' V/Line rail routes')
  process.exit()
})
