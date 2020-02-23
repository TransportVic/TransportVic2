const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')
const mergeStops = require('./utils/merge-stops')
const updateStats = require('./utils/gtfs-stats')
const busDestinations = require('../additional-data/bus-destinations')
const utils = require('../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let gtfsTimetables = null
let routes = null

let start = new Date()

database.connect({}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  routes = database.getCollection('routes')

  let allRoutes = await routes.distinct('routeGTFSID', {
    mode: {
      $ne: 'metro train'
    }
  })
  let stopsByService = []

  await async.forEach(allRoutes, async routeGTFSID => {
    let routeData = await routes.findDocument({ routeGTFSID })
    let routeVariants = routeData.routePath
      .map(variant => variant.fullGTFSIDs.slice(0, 1))
      .reduce((acc, r) => acc.concat(r), [])
    let routeDirections = []

    await async.forEach(routeVariants, async variant => {
      let timetable = await gtfsTimetables.findDocument({shapeID: variant})
      if (!timetable) return console.log('No timetable match for shapeID ' + variant)

      if (!routeDirections[timetable.gtfsDirection]) routeDirections[timetable.gtfsDirection] = []

      routeDirections[timetable.gtfsDirection].push(timetable.stopTimings.map(e => ({stopName: e.stopName, stopGTFSID: e.stopGTFSID})))
    })

    routeDirections.forEach((direction, gtfsDirection) => {
      let mergedStops = mergeStops(direction, (a, b) => a.stopName == b.stopName)

      let directionName = mergedStops.slice(-1)[0].stopName

      let directionShortName = directionName.split('/')[0]
      if (!utils.isStreet(directionShortName)) directionName = directionShortName

      let serviceData = busDestinations.service[routeData.routeNumber] || busDestinations.service[routeGTFSID] || {}

      directionName = serviceData[directionName]
        || busDestinations.generic[directionName] || directionName

      if (!stopsByService[routeGTFSID]) stopsByService[routeGTFSID] = []
      stopsByService[routeGTFSID].push({
        directionName,
        gtfsDirection,
        stops: mergedStops
      })
    })
  })

  let bulkOperations = []

  Object.keys(stopsByService).forEach(routeGTFSID => {
    bulkOperations.push({
      updateOne: {
        filter: { routeGTFSID },
        update: { $set: {
          directions: stopsByService[routeGTFSID]
        } }
      }
    })
  })

  await routes.bulkWrite(bulkOperations)
  await updateStats('route-stops', bulkOperations.length, new Date() - start)

  console.log('Completed loading in ' + bulkOperations.length + ' route stops')
  process.exit()
});
