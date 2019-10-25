const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')
const mergeStops = require('./utils/merge-stops')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let gtfsTimetables = null
let routes = null

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
    let routeVariants = (await routes.findDocument({ routeGTFSID })).routePath
      .map(variant => variant.fullGTFSIDs.slice(0, 1))
      .reduce((acc, r) => acc.concat(r), [])
    let routeDirections = []

    await async.forEach(routeVariants, async variant => {
      let timetable = await gtfsTimetables.findDocument({shapeID: variant})

      if (!routeDirections[timetable.gtfsDirection]) routeDirections[timetable.gtfsDirection] = []

      routeDirections[timetable.gtfsDirection].push(timetable.stopTimings.map(e => ({stopName: e.stopName, stopGTFSID: e.stopGTFSID})))
    })

    routeDirections.forEach(direction => {
      let mergedStops = mergeStops(direction, (a, b) => a.stopName == b.stopName)

      let directionName = mergedStops.slice(-1)[0].stopName

      if (!stopsByService[routeGTFSID]) stopsByService[routeGTFSID] = []
      stopsByService[routeGTFSID].push({
        directionName,
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

  console.log('Completed loading in ' + bulkOperations.length + ' route stops')
  process.exit()
});
