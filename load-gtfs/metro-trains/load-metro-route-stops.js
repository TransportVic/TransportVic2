const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const async = require('async')
const mergeStops = require('../utils/merge-stops')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let gtfsTimetables = null
let routes = null
let cityLoopStations = ['southern cross', 'parliament', 'flagstaff', 'melbourne central']
  .map(e => e + ' railway station')

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

  let allRoutes = await routes.distinct('routeGTFSID', { mode: 'metro train' })
  let stopsByService = []

  await async.forEach(allRoutes, async routeGTFSID => {
    let routeVariants = (await routes.findDocument({ routeGTFSID })).routePath
      .map(variant => variant.fullGTFSIDs)
      .reduce((acc, r) => acc.concat(r), [])
    let routeDirections = []

    await async.forEach(routeVariants, async variant => {
      let timetable = await gtfsTimetables.findDocument({shapeID: variant})

      if (!routeDirections[timetable.gtfsDirection]) routeDirections[timetable.gtfsDirection] = []

      routeDirections[timetable.gtfsDirection].push(timetable.stopTimings.map(e => ({stopName: e.stopName, stopGTFSID: e.stopGTFSID})))
    })

    routeDirections.forEach(direction => {
      let mergedStops = mergeStops(direction, (a, b) => a.stopName == b.stopName)
        .filter(stop => !cityLoopStations.includes(stop.stopName.toLowerCase()))

      let directionName = mergedStops.slice(-1)[0].stopName

      let flindersStreetIndex = 0

      for (let stop of mergedStops) {
        if (stop.stopName === 'Flinders Street Railway Station') break
        flindersStreetIndex++
      }

      let cityLoopStops = []

      if (richmondGroup.includes(routeGTFSID) || cliftonHillGroup.includes(routeGTFSID)) {
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
      } else if (northernGroup.includes(routeGTFSID)) {
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
      }

      cityLoopStops = cityLoopStops.map(station => {
        return {
          stopName: station[0] + ' Railway Station',
          stopGTFSID: station[1]
        }
      })

      if (routeGTFSID !== '2-SPT')
        if (flindersStreetIndex >= mergedStops.length - 3) {
          directionName = 'City'
          mergedStops = mergedStops.slice(0, -1).concat(cityLoopStops)
        } else {
          directionName = directionName.slice(0, -16)
          cityLoopStops.reverse()
          mergedStops = cityLoopStops.concat(mergedStops.slice(1))
        }

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
