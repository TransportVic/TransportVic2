const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const EventEmitter = require('events')
const turf = require('@turf/turf')

let stopLoader = {}
let stopCache = {}

async function getStop(db, stopGTFSID, stopName, routeGTFSID) {
  let id = stopName + routeGTFSID
  let stops = db.getCollection('stops')

  if (stopLoader[id]) {
    return await new Promise(resolve => stopLoader[id].on('loaded', resolve))
  } else if (!stopCache[id]) {
    stopLoader[id] = new EventEmitter()
    stopLoader[id].setMaxListeners(1000)

    let stop = await stops.findDocument({
      'bays.stopGTFSID': stopGTFSID
    })
    let bay = stop.bays.find(bay => bay.stopGTFSID == stopGTFSID)

    stopCache[id] = bay
    stopLoader[id].emit('loaded', bay)
    delete stopLoader[id]

    return bay
  } else return stopCache[id]
}

router.get('/', (req, res) => {
  res.render('transit-visualiser/index')
})

router.get('/timetables/:route', async (req, res) => {
  let {db} = res
  const dbRoutes = db.getCollection('routes')
  const gtfsTimetables = db.getCollection('gtfs timetables')
  const minutesPastMidnight = utils.getMinutesPastMidnightNow()
  const {route} = req.params
  let operationDays = [utils.getYYYYMMDDNow()]
  let check = [{
    tripStartMinute: {
      $lte: minutesPastMidnight - 5
    },
    tripEndMinute: {
      $gte: minutesPastMidnight + 5
    }
  }]
  if (minutesPastMidnight < 240) {
    operationDays.push(utils.getYYYYMMDD(utils.now().add(-1, 'days')))
    check.push({
      tripStartMinute: {
        $lte: minutesPastMidnight + 1440
      },
      tripEndMinute: {
        $gte: minutesPastMidnight + 1450
      }
    })
  }

  let query = {
    operationDays: {$in: operationDays},
    routeGTFSID: route,
    $or: check
  }

  let trips = await gtfsTimetables.findDocuments(query).toArray()

  let routeData = await dbRoutes.findDocument({
    routeGTFSID: route
  })

  let stops = {}
  await async.forEach(routeData.directions, async direction => {
    await async.forEach(direction.stops, async stop => {
      let dbStop = await getStop(db, stop.stopGTFSID, stop.stopName, route)

      stops[stop.stopGTFSID] = dbStop
    })
  })

  let relevantShapeIDs = trips.map(t => t.shapeID)
    .filter((e, i, a) => a.indexOf(e) === i)

  let stopDistances = {}
  await async.forEach(relevantShapeIDs, async gtfsID => {
    let sampleTrip = await gtfsTimetables.findDocument({ shapeID: gtfsID })
    let path = routeData.routePath.find(path => path.fullGTFSIDs.includes(gtfsID))
    let startingLocation = turf.point(path.path[0])
    let line = turf.lineString(path.path)

    stopDistances[gtfsID] = {}

    await async.forEach(sampleTrip.stopTimings, async stop => {
      let stopData = stops[stop.stopGTFSID]

      let stopPosition = turf.nearestPointOnLine(line, turf.point(stopData.location.coordinates))

      let distance = turf.length(turf.lineSlice(startingLocation, stopPosition, line), {units: 'kilometers'})

      stopDistances[gtfsID][stop.stopGTFSID] = distance
    })
  })

  res.json({routeData, trips, stops, stopDistances})
})

module.exports = router
