const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const loadRoutes = require('../utils/load-routes')
const { createServiceLookup } = require('../utils/datamart-utils')
const utils = require('../../utils')
const datamartModes = require('../datamart-modes')
const operatorOverrides = require('../../additional-data/operator-overrides')
const loopDirections = require('../../additional-data/loop-direction')
const gtfsUtils = require('../../gtfs-utils')

const routeNames = require('../../additional-data/bus-data/route-name-overrides')
const routeNumbers = require('../../additional-data/bus-data/route-number-overrides')
const metroOperators = require('../../additional-data/bus-data/metro-operators')
const regionalOperators = require('../../additional-data/bus-data/regional-operators')
const regionalRouteNumbers = require('../../additional-data/bus-data/regional-with-track')

let regionalGTFSIDs = Object.keys(regionalRouteNumbers).reduce((acc, region) => {
  let regionRoutes = regionalRouteNumbers[region]

  regionRoutes.forEach(route => {
    acc[route.routeGTFSID] = { region, routeNumber: route.routeNumber }
  })

  return acc
}, {})

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = parseInt(process.argv[2])
let datamartMode = datamartModes[gtfsID]

let datamartRoutes = []
try {
  datamartRoutes = require(`../../spatial-datamart/${datamartMode}-route`).features
} catch (e) { console.log('Could not load spatial datamart, skipping') }

let serviceLookup = createServiceLookup(datamartRoutes)

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let splicedGTFSPath = path.join(__dirname, `../spliced-gtfs-stuff/${gtfsID}`)
  let gtfsPath = path.join(__dirname, `../../gtfs/${gtfsID}`)

  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  let allRoutes = routeData.map(r => gtfsUtils.parseBusRouteGTFSID(r[0])).filter((e, i, a) => a.indexOf(e) === i)

  async function load(shapeJSON) {
    return await loadRoutes(routes, gtfsID, routeData, shapeJSON, (routeGTFSID, routeNumber, routeName) => {
      if ((routeGTFSID.startsWith('4-') || routeGTFSID.startsWith('8-')) && metroOperators[routeNumber]) {
        return metroOperators[routeNumber]
      }

      if (regionalGTFSIDs[routeGTFSID]) {
        let routeData = regionalGTFSIDs[routeGTFSID]
        if (regionalOperators[routeData.region] && regionalOperators[routeData.region][routeData.routeNumber]) {
          return regionalOperators[routeData.region][routeData.routeNumber]
        }

        console.log(routeGTFSID, routeName, routeNumber, 'missing from defined town region', routeData.region)
      }

      if (operatorOverrides[routeGTFSID]) return operatorOverrides[routeGTFSID]
      if (serviceLookup[routeGTFSID]) return serviceLookup[routeGTFSID].operator

      let routeMatch = Object.values(serviceLookup).find(route => {
        return routeName === route.routeName && routeNumber === route.routeNumber
      })
      if (routeMatch) return routeMatch.operator

      console.log(`Could not map operator for ${routeGTFSID}: ${routeNumber} ${routeName}`)

      return ['Unknown Operator']
    }, (routeNumber, routeName, routeGTFSID) => {
      let newRouteName = utils.adjustRouteName(routeName)
      if (routeNames[routeGTFSID]) return routeNames[routeGTFSID]

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
      if (routeNumbers[routeGTFSID]) return routeNumbers[routeGTFSID]
      
      let parts
      if (parts = routeNumber.match(/[a-z]+ (\d+)x?$/i)) return parts[1]

      if (routeNumber.includes('NSW')) return routeNumber.match(/(\d+)/)[1]

      return (routeNumber && routeNumber.length ? routeNumber.replace('x', '') : null)
    })
  }

  let routeShapesSeen = []

  await async.forEachSeries(shapeFiles, async shapeFile => {
    let shapeJSON = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, shapeFile)))
    routeShapesSeen = routeShapesSeen.concat(await load(shapeJSON))
  })

  await async.forEachSeries(allRoutes, async routeGTFSID => {
    if (!routeShapesSeen.includes(routeGTFSID)) {
      console.log('Found that', routeGTFSID, 'does not have a route shape programmed in, giving it a default one')

      await load([{
        shapeID: "",
        routeGTFSID: routeGTFSID,
        path: {
          type: 'LineString',
          coordinates: [[ 144, -38 ], [ 144, -38.01 ]]
        },
        length: 1
      }])
      routeShapesSeen.push(routeGTFSID)
    }
  })

  await updateStats(datamartMode + '-routes', routeShapesSeen.length)
  console.log(`Completed loading in ${routeShapesSeen.length} ${datamartMode} bus routes`)
  process.exit()
})
