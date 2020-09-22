const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('../../TimedCache')
const utils = require('../../utils')
const EventEmitter = require('events')
const tramFleet = require('../../tram-fleet')
const urls = require('../../urls')
const determineTramRouteNumber = require('./determine-tram-route-number')

const departuresCache = new TimedCache(1000 * 60)

let ytAPILocks = {}

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

async function getDeparturesFromYT(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let tramTrips = db.getCollection('tram trips')
  let tramStops = stop.bays.filter(b => b.mode === 'tram' && b.tramTrackerID)
  let tramTrackerIDs = tramStops.map(b => b.tramTrackerID)

  let mappedDepartures = []
  let now = utils.now()

  await async.forEach(tramStops, async bay => {
    let {stopGTFSID, tramTrackerID} = bay

    let {responseObject} = JSON.parse(await utils.request(urls.yarraStopNext3.format(tramTrackerID)))

    await async.forEach(responseObject, async tramDeparture => {
      let {Prediction, AVMTime, HeadBoardRouteNo, RunNo, Schedule, TramDistance, VehicleNo, Destination} = tramDeparture
      let scheduledTimeMS = parseInt(Schedule.slice(0, -1).match(/(\d+)\+/)[1])
      let avmTimeMS = parseInt(AVMTime.slice(0, -1).match(/(\d+)\+/)[1])

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

      let tram = null
      if (VehicleNo !== 0) {
        let model = tramFleet.getModel(VehicleNo)
        tram = {
          name: `${model}.${VehicleNo}`,
          attributes: tramFleet.data[model]
        }
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

      if (tram) {
        let firstStop = trip.stopTimings[0]
        let currentStop = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
        let minutesDiff = currentStop.departureTimeMinutes - firstStop.departureTimeMinutes
        let originDepartureTime = scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

        let date = utils.getYYYYMMDD(originDepartureTime)

        let query = {
          date,
          origin: trip.origin,
          destination: trip.destination,
          departureTime: trip.departureTime,
          destinationArrivalTime: trip.destinationArrivalTime
        }

        let tripData = {
          ...query,
          tram: VehicleNo
        }

        await tramTrips.replaceDocument(query, tripData, {
          upsert: true
        })
      }

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: Destination,
        loopDirection,
        vehicle: tram,
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
  let cacheKey = stop.stopName

  if (ytAPILocks[cacheKey]) {
    return await new Promise(resolve => {
      ytAPILocks[cacheKey].on('done', data => {
        resolve(data)
      })
    })
  }

  if (departuresCache.get(cacheKey)) {
    return departuresCache.get(cacheKey)
  }

  ytAPILocks[cacheKey] = new EventEmitter()

  function returnDepartures(departures) {
    ytAPILocks[cacheKey].emit('done', departures)
    delete ytAPILocks[cacheKey]

    return departures
  }

  let departures

  try {
    try {
      departures = await getDeparturesFromYT(stop, db)
      departuresCache.put(cacheKey, departures)

      return returnDepartures(departures)
    } catch (e) {
      console.log(e)
      departures = (await getScheduledDepartures(stop, db, false)).map(departure => {
        departure.routeNumber = determineTramRouteNumber(departure.trip)
        departure.sortNumber = departure.routeNumber.replace(/[a-z]/, '')

        return departure
      })

      return returnDepartures(departures)
    }
  } catch (e) {
    console.log(e)
    return returnDepartures(null)
  }

  return departures
}

module.exports = getDepartures
