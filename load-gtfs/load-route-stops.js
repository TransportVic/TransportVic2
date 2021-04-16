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

  let stopsByService = {}

  await async.forEachLimit(allRoutes, 100, async routeGTFSID => {
    let routeData = await routes.findDocument({ routeGTFSID })
    let routeVariants = routeData.routePath.map(variant => ({ shapeID: variant.fullGTFSIDs[0], routeGTFSID }))

    // Because sydney uses 1 route shape for all variants this trick doesn't work
    // Only one route, XPT doesn't have too many trips so additional overhead is acceptable
    if (routeGTFSID === '14-XPT') {
      routeVariants = (await gtfsTimetables.distinct('tripID', { routeGTFSID })).map(tripID => ({ tripID }))
    }
    let routeDirections = []

    await async.forEach(routeVariants, async variant => {
      let timetable = await gtfsTimetables.findDocument(variant)
      if (!timetable) return console.log('No timetable match for shapeID', variant)

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

      let lastStop = mergedStops.slice(-1)[0]
      let lastStopName = lastStop.stopName

      let directionName

      if (lastStopName.includes('School') || lastStopName.includes('College')) directionName = mostCommonDestination
      else directionName = lastStopName

      let directionShortName = directionName.split('/')[0].replace('Shopping Centre', 'SC')
      if (!utils.isStreet(directionShortName)) directionName = directionShortName

      if (routeData.flags && routeData.flags[1]) {
        directionName += ` (${routeData.flags[gtfsDirection]})`
      }

      if (routeGTFSID === '3-35') {
        directionName = `Waterfront City Docklands (${gtfsDirection == 0 ? 'Anti-' : ''}Clockwise)`
      }

      let serviceData = busDestinations.service[routeGTFSID] || busDestinations.service[routeData.routeNumber] || {}

      directionName = serviceData[directionName]
        || busDestinations.generic[directionName]
        || coachDestinations(lastStop) || tramDestinations[directionName] || directionName

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
          directions: stopsByService[routeGTFSID].filter(Boolean) // Apparently some routes dont have GTFS Dir 0
        } }
      }
    })
  })

  await routes.bulkWrite(bulkOperations)

  await updateStats('route-stops', bulkOperations.length)
  console.log('Completed loading in ' + bulkOperations.length + ' route stops')
  process.exit()
});
