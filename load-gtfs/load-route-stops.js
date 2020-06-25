const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')
const mergeStops = require('./utils/merge-stops')
const updateStats = require('./utils/stats')
const busDestinations = require('../additional-data/bus-destinations')
const coachDestinations = require('../additional-data/coach-stops')
const tramDestinations = require('../additional-data/tram-destinations')
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

      routeDirections[timetable.gtfsDirection].push(timetable.stopTimings.map(e => ({
        stopName: e.stopName,
        stopNumber: e.stopNumber,
        suburb: e.suburb,
        stopGTFSID: e.stopGTFSID
      })))
    })

    await async.forEachOf(routeDirections, async (direction, gtfsDirection) => {
      if (!direction) return
      let mergedStops = mergeStops(direction, (a, b) => a.stopName == b.stopName)

      let mostCommonOrigin = (await gtfsTimetables.aggregate([{
          $match: {
            routeGTFSID,
            gtfsDirection: gtfsDirection.toString()
          }
        }, {
          "$sortByCount": "$origin"
      }]).toArray())[0]._id

      let mostCommonDestinations = (await gtfsTimetables.aggregate([{
          $match: {
            routeGTFSID,
            gtfsDirection: gtfsDirection.toString()
          }
        }, {
          "$sortByCount": "$destination"
      }]).toArray()).map(e => e._id)

      let mostCommonDestination

      if (mostCommonDestinations[0] === mostCommonOrigin && mostCommonDestinations.length > 1) mostCommonDestinations.shift()
      mostCommonDestination = mostCommonDestinations[0]

      let lastStop = mergedStops.slice(-1)[0].stopName

      let directionName

      if (lastStop.includes('School') || lastStop.includes('College')) directionName = mostCommonDestination
      else directionName = lastStop

      let directionShortName = directionName.split('/')[0]
      if (!utils.isStreet(directionShortName)) directionName = directionShortName

      if (routeData.flags && routeData.flags[1]) {
        directionName += ` (${routeData.flags[gtfsDirection]})`
      }

      let serviceData = busDestinations.service[routeData.routeNumber] || busDestinations.service[routeGTFSID] || {}

      directionName = serviceData[directionName]
        || busDestinations.generic[directionName]
        || coachDestinations[directionName] || tramDestinations[directionName] || directionName

      if (!stopsByService[routeGTFSID]) stopsByService[routeGTFSID] = []
      stopsByService[routeGTFSID][gtfsDirection] = {
        directionName,
        gtfsDirection,
        stops: mergedStops
      }
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

  await updateStats('route-stops', bulkOperations.length)
  console.log('Completed loading in ' + bulkOperations.length + ' route stops')
  process.exit()
});
