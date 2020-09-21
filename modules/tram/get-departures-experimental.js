const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('../../TimedCache')
const utils = require('../../utils')
const EventEmitter = require('events')
const tramFleet = require('../../tram-fleet')
const urls = require('../../urls')

const departuresCache = new TimedCache(1000 * 60)

let ptvAPILocks = {}

async function getDeparture(db, stopGTFSID, scheduledDepartureTimeMinutes, routeGTFSID) {
  let trip
  let today = utils.now()
  let query

  for (let i = 0; i <= 1; i++) {
    let tripDay = today.clone().add(-i, 'days')
    let departureTimeMinutes = scheduledDepartureTimeMinutes % 1440 + 1440 * i
    let variedDepartureTimeMinutes = {
      $gte: departureTimeMinutes - 4,
      $lte: departureTimeMinutes + 4
    }

    query = {
      operationDays: utils.getYYYYMMDD(tripDay),
      mode: 'tram',
      stopTimings: {
        $elemMatch: {
          stopGTFSID,
          departureTimeMinutes: variedDepartureTimeMinutes
        }
      },
      routeGTFSID
    }

    let timetable = await db.getCollection('live timetables').findDocument(query)
    if (!timetable) {
      timetable = await db.getCollection('gtfs timetables').findDocument(query)
    }

    if (timetable) {
      trip = timetable
      break
    }
  }

  if (!trip) {
    return null
  }

  return trip
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let tramTrackerIDs = stop.bays.filter(b => b.mode === 'tram' && b.tramTrackerID).map(b => b.tramTrackerID)
  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram', false, false)

  let mappedDepartures = []
  let now = utils.now()

  await async.forEach(stop.bays.filter(b => b.mode === 'tram' && b.tramTrackerID), async bay => {
    let {stopGTFSID, tramTrackerID} = bay

    //todo put route number as part of route and timetable db
    let {responseObject} = JSON.parse(await utils.request(urls.yarraStopNext3.format(tramTrackerID)))

    await async.forEach(responseObject, async tramDeparture => {
      let {Prediction, AVMTime, Down, HeadBoardRouteNo, RunNo, Schedule, TramDistance, VehicleNo, Destination} = tramDeparture
      let scheduledTimeMS = parseInt(Schedule.slice(0, -1).match(/(\d)+\+/)[0])
      let avmTimeMS = parseInt(AVMTime.slice(0, -1).match(/(\d)+\+/)[0])

      let scheduledDepartureTime = utils.parseTime(scheduledTimeMS)
      let estimatedDepartureTime = utils.parseTime(avmTimeMS + Prediction * 1000)
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

      if (actualDepartureTime.diff(now, 'minutes') > 90) return

      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime) % 1440
      let day = utils.getYYYYMMDD(scheduledDepartureTime)

      let coreRoute = HeadBoardRouteNo.replace(/[a-z]/, '')

      let routeGTFSID = `3-${coreRoute}`

      let trip = await getDeparture(db, stopGTFSID, scheduledDepartureTimeMinutes, routeGTFSID)
      if (!trip) return

      let tram = {}
      if (VehicleNo !== 0) {
        tram.id = VehicleNo
        tram.model = tramFleet.getModel(VehicleNo)
        tram.data = tramFleet.data[tram.model]
      } else {
        estimatedDepartureTime = null
        actualDepartureTime = scheduledDepartureTime

        if (scheduledDepartureTime.diff(now, 'minutes') > 90) return
      }


      let hasBussingMessage = Destination.includes('bus around')

      let loopDirection
      if (routeGTFSID === '3-35') {
        loopDirection = gtfsDirection === '0' ? 'AC/W' : 'C/W'
      }

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: Destination,
        loopDirection,
        vehicle: tram.id ? {
          name: `${tram.model}.${tram.id}`,
          attributes: tram.data
        } : null,
        routeNumber: HeadBoardRouteNo,
        sortNumber: coreRoute,
        hasBussingMessage
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'tram', 90, false)
}

async function getDepartures(stop, db) {
  let cacheKey = stop.stopName + 'T'

  if (ptvAPILocks[cacheKey]) {
    return await new Promise(resolve => {
      ptvAPILocks[cacheKey].on('done', data => {
        resolve(data)
      })
    })
  }

  if (departuresCache.get(cacheKey)) {
    return departuresCache.get(cacheKey)
  }

  ptvAPILocks[cacheKey] = new EventEmitter()

  function returnDepartures(departures) {
    ptvAPILocks[cacheKey].emit('done', departures)
    delete ptvAPILocks[cacheKey]

    return departures
  }

  let departures

  try {
    try {
      departures = await getDeparturesFromPTV(stop, db)
      departuresCache.put(cacheKey, departures)

      return returnDepartures(departures)
    } catch (e) {
      console.log(e)
      departures = (await getScheduledDepartures(stop, db, false)).map(departure => {
        departure.vehicleDescriptor = {}
        return departure
      })

      return returnDepartures(departures)
    }
  } catch (e) {
    return returnDepartures(null)
  }

  return departures
}

module.exports = getDepartures
