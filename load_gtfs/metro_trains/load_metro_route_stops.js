const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let gtfsTimetables = null
let routes = null

let richmondGroup = [
  "2-ALM",
  "2-BEL",
  "2-GLW",
  "2-LIL",
  "2-CRB",
  "2-FKN",
  "2-PKM",
  "2-SDM"
]

let northernGroup = [
  "2-B31", // craigieburn
  "2-SYM",
  "2-UFD",
  "2-WBE",
  "2-WMN",
  "2-ain"
]

let cliftonHillGroup = [
  "2-MER",
  "2-HBG"
]

database.connect({
  poolSize: 500
}, async err => {
  gtfsTimetables = database.getCollection('gtfs timetables')
  routes = database.getCollection('routes')

  let routeStops = await gtfsTimetables.aggregate([
    {
      $match: {
        "stopTimings.stopName": {
          $not: {
            $eq: "Flagstaff Railway Station"
          }
        },
        mode: "metro train"
      }
    },
    {
      $match: {
        $expr: {
          $or: [
            {
              $and: [
                {
                  $eq: [ { $concat: ["$routeName", " Railway Station"] }, "$origin" ]
                },
                {
                  $eq: [ "Flinders Street Railway Station", "$destination" ]
                },
                {
                  $ne: [ "$routeName", "Frankston" ]
                }
              ]
            },
            {
              $and: [
                {
                  $eq: [ { $concat: ["$routeName", " Railway Station"] }, "$origin" ]
                },
                {
                  $eq: [ "Southern Cross Railway Station", "$destination" ]
                }
              ]
            },

            {
              $and: [
                {
                  $eq: [ { $concat: ["$routeName", " Railway Station"] }, "$destination" ]
                },
                {
                  $eq: [ "Flinders Street Railway Station", "$origin" ]
                },
                {
                  $ne: [ "$routeName", "Frankston" ]
                }
              ]
            },
            {
              $and: [
                {
                  $eq: [ { $concat: ["$routeName", " Railway Station"] }, "$destination" ]
                },
                {
                  $eq: [ "Southern Cross Railway Station", "$origin" ]
                }
              ]
            },

            {
              $and: [
                {
                  $eq: [ "Flemington Racecourse Railway Station", "$destination" ]
                },
                {
                  $eq: [ "Southern Cross Railway Station", "$origin" ]
                },
                {
                  $eq: [ "$routeName", "Showgrounds/Flemington" ]
                }
              ]
            },
            {
              $and: [
                {
                  $eq: [ "Southern Cross Railway Station", "$destination" ]
                },
                {
                  $eq: [ "Flemington Racecourse Railway Station", "$origin" ]
                },
                {
                  $eq: [ "$routeName", "Showgrounds/Flemington" ]
                }
              ]
            }
          ]
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

    let {stops} = route
    let flindersStreetIndex = 0

    for (let stop of stops) {
      if (stop.stopName === 'Flinders Street Railway Station') break
      flindersStreetIndex++
    }

    let cityLoopStops = []
    let sliceOffset = 1

    if (richmondGroup.includes(route.routeGTFSID) || cliftonHillGroup.includes(route.routeGTFSID)) {
      cityLoopStops = [
        [ "Parliament", 19843 ],
        [ "Melbourne Central", 19842 ],
        [ "Flagstaff", 19841 ],
        [ "Southern Cross", 22180 ],

        [ "Flinders Street", 19854 ],

        [ "Southern Cross", 22180 ],
        [ "Flagstaff", 19841 ],
        [ "Melbourne Central", 19842 ],
        [ "Parliament", 19843 ],
      ]
    } else if (northernGroup.includes(route.routeGTFSID)) {
      cityLoopStops = [
        [ "Flagstaff", 19841 ],
        [ "Melbourne Central", 19842 ],
        [ "Parliament", 19843 ],
        [ "Southern Cross", 22180 ],

        [ "Flinders Street", 19854 ],

        [ "Southern Cross", 22180 ],
        [ "Parliament", 19843 ],
        [ "Melbourne Central", 19842 ],
        [ "Flagstaff", 19841 ]
      ]
      sliceOffset = 2
    }
    if (route.routeGTFSID === '2-FKN') sliceOffset = 2

    cityLoopStops = cityLoopStops.map(station => {
      return {
        stopName: station[0] + ' Railway Station',
        stopGTFSID: station[1]
      }
    })

    if (flindersStreetIndex >= stops.length - 3) {
      directionName = 'City'
      route.stops = route.stops.slice(0, -sliceOffset).concat(cityLoopStops)
    } else {
      directionName = directionName.slice(0, -16)
      cityLoopStops.reverse()
      route.stops = cityLoopStops.concat(route.stops.slice(sliceOffset))
    }

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

  console.log('Completed loading in ' + bulkOperations.length + ' route stops')
  process.exit()
});
