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
const gtfsUtils = require('../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = process.argv[2]
let datamartMode = datamartModes[gtfsID]

let datamartRoutes = []
try {
  datamartRoutes = require(`../../spatial-datamart/${datamartMode}-route.json`).features
} catch (e) { console.log('Could not load spatial datamart, skipping') }

let serviceLookup = createServiceLookup(datamartRoutes)

if (gtfsID === '7') datamartMode = 'telebus'

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  let ptvRouteData = (await ptvAPI('/v3/routes?route_types=2')).routes.filter(route => {
    return route.route_gtfs_id && route.route_gtfs_id.startsWith(`${gtfsID}-`)
  }).map(route => {
    route.routeGTFSID = route.route_gtfs_id.replace(/-0+/, '-')
    route.adjustedName = utils.adjustRouteName(route.route_name)
    route.originalName = route.route_name

    return route
  })

  let routesNeedingVia = []
  let routeNames = {}

  let ptvRoutes = ptvRouteData.reduce((acc, route) => {
    let {routeGTFSID, adjustedName} = route

    if (routeNames[adjustedName]) {
      routesNeedingVia.push(routeNames[adjustedName])
      routesNeedingVia.push(routeGTFSID)
    } else {
      routeNames[adjustedName] = routeGTFSID
    }

    acc[routeGTFSID] = adjustedName
    return acc
  }, {})

  routesNeedingVia.forEach(routeGTFSID => {
    ptvRoutes[routeGTFSID] = ptvRouteData.find(route => route.routeGTFSID === routeGTFSID).originalName.replace(/ \((From|Until) .+\)$/, '')
  })

  ptvRoutes['4-676'] = 'Lilydale East Loop'

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let gtfsPath = path.join(__dirname, '../../gtfs', `${gtfsID}`)

  let routeData = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'routes.txt')).toString())
  let shapeFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('shapes'))

  let allRoutes = routeData.map(r => gtfsUtils.simplifyRouteGTFSID(r[0])).filter((e, i, a) => a.indexOf(e) === i)

  async function load(shapeJSON) {
    return await loadRoutes(routes, gtfsID, routeData, shapeJSON, (routeGTFSID, routeNumber, routeName) => {
      if (operatorOverrides[routeGTFSID]) return operatorOverrides[routeGTFSID]
      if (serviceLookup[routeGTFSID]) return serviceLookup[routeGTFSID].operator

      let routeMatch = Object.values(serviceLookup).find(route => {
        return routeName === route.routeName && routeNumber === route.routeNumber
      })
      if (routeMatch) return routeMatch.operator

      console.log(`Could not map operator for ${routeGTFSID}: ${routeNumber} ${routeName}`)

      return ['Unknown Operator']
    }, (routeNumber, routeName, routeGTFSID) => {
      let newRouteName = ptvRoutes[routeGTFSID] || routeName
      if (routeGTFSID === '11-SKl') {
        return 'Skybus - Skybus Link'
      }

      if (routeGTFSID === '6-SY4') {
        return 'Wimble Street - Seymour'
      }

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
      if (routeGTFSID === '6-a28') return null

      if (routeGTFSID === '6-R54') return null

      if (routeGTFSID === '6-gld') return null

      if (routeGTFSID === '6-a48') return null
      if (routeGTFSID === '6-a49') return null

      if (routeGTFSID === '6-946') return null
      if (routeGTFSID === '6-949') return null

      if (routeGTFSID === '6-906') return '906'
      if (routeGTFSID === '6-907') return '907'
      if (routeGTFSID === '6-908') return '908'

      if (routeGTFSID === '6-WN1') return '1'
      if (routeGTFSID === '6-WN2') return '2'
      if (routeGTFSID === '6-WN3') return '3'
      if (routeGTFSID === '6-W12') return 'A'

      return routeNumber
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
        path: [[ 144, -38 ]],
        length: 1
      }])
      routeShapesSeen.push(routeGTFSID)
    }
  })

  await updateStats(datamartMode + '-routes', routeShapesSeen.length)
  console.log(`Completed loading in ${routeShapesSeen.length} ${datamartMode} bus routes`)
  process.exit()
})
