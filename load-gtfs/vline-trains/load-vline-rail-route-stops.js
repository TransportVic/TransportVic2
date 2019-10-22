const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()
let gtfsTimetables = null
let routes = null

database.connect({
  poolSize: 500
}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  routes = database.getCollection('routes')

  let routeStops = await gtfsTimetables.aggregate([
    {
      $match: {
        $expr: {
          $and: [{
            $eq: ["$destination", "Southern Cross Railway Station"]
          }, {
            $eq: ["$origin", { $concat: ["$shortRouteName", " Railway Station"] }]
          }, {
            mode: "regional train"
          }]
        }
      }
    },
    {
      $set: {
        stops: {
          $map: {
            input: "$stopTimings",
            as: "stop",
            in: {
              k: {
                $toString: "$$stop.stopSequence"
              },
              v: {
                stopName: "$$stop.stopName",
                stopGTFSID: "$$stop.stopGTFSID",
                stopNumber: "$$stop.stopNumber",
              }
            }
          }
        },
        stopTimings: null,
        id: {
          $concat: ["$routeGTFSID", "-", "$gtfsDirection"]
        }
      }
    },
    {
      $group: {
        _id: "$id",
        stops: {
          $mergeObjects: {
            $arrayToObject: "$stops"
          }
        }
      }
    }
  ]).toArray()

  routeStops = routeStops.map(route => {
    let routeGTFSID = route._id.slice(0, -2)
    let routeDirection = route._id.slice(-1)
    let routeType = parseInt(routeGTFSID.split('-')[0])

    route.routeGTFSID = routeGTFSID
    route.routeDirection = routeDirection
    route.routeType = routeType

    route.stops = Object.values(route.stops)

    return route;
  })

  let stopsByService = {}

  await async.forEach(routeStops, async route => {
    let directionName = route.stops.slice(-1)[0].stopName
    directionName = directionName.slice(0, -16)

    if (!stopsByService[route.routeGTFSID]) stopsByService[route.routeGTFSID] = []
    stopsByService[route.routeGTFSID].push({
      directionName,
      stops: route.stops
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

  await updateStats('vline-route-stops', bulkOperations.length, new Date() - start)
  console.log('Completed loading in ' + bulkOperations.length + ' route stops')
  process.exit()
});
