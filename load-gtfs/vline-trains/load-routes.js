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

let gtfsID = 1

let routeNames = {
  '1-BDE': 'Bairnsdale',
  '1-ECH': 'Echuca',
  '1-ABY': 'Albury',
  '1-ART': 'Ararat',
  '1-BAT': 'Ballarat',
  '1-BGO': 'Bendigo',
  '1-GEL': 'Geelong',
  '1-MBY': 'Maryborough',
  '1-SNH': 'Shepparton',
  '1-SWL': 'Swan Hill',
  '1-TRN': 'Traralgon',
  '1-WBL': 'Warrnambool',
  '1-SER': 'Seymour'
}

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let splicedGTFSPath = path.join(__dirname, `../spliced-gtfs-stuff/${gtfsID}`)
  let gtfsPath = path.join(__dirname, `../../gtfs/${gtfsID}`)

  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    shapeJSON = shapeJSON.filter(shape => {
      return shape.routeGTFSID !== '1-vPK' && shape.routeGTFSID !== '1-Vov'
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
