import departureUtils from '../utils/get-bus-timetables.mjs'
import async from 'async'
import utils from '../../utils.mjs'
import tramFleet from '../../additional-data/tram-tracker/tram-fleet.js'
import urls from '../../urls.json' with { type: 'json' }
import determineTramRouteNumber from './determine-tram-route-number.js'
import { trimFromDestination, trimFromMessage } from './trim-trip.mjs'
import { distance } from 'fastest-levenshtein'
import tramDestinations from '../../additional-data/tram-destinations.json' with { type: 'json' }

function findScore(trip, stopGTFSID, departureTimeMinutes) {
  let stopData = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
  return Math.abs(stopData.departureTimeMinutes - departureTimeMinutes)
}

async function getDeparture(db, stopGTFSID, scheduledDepartureTimeMinutes, routeGTFSID, destination) {
  let trip
  let today = utils.now()
  if (today.get('hours') < 3) today.add(-1, 'day')
  let query

  for (let i = 0; i <= 1; i++) {
    let tripDay = today.clone().add(-i, 'days')
    let departureTimeMinutes = scheduledDepartureTimeMinutes + 1440 * i
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

    let timetables = await db.getCollection('live timetables').findDocuments(query).toArray()
    let gtfsTimetables = await db.getCollection('gtfs timetables').findDocuments(query).toArray()

    gtfsTimetables.forEach(gtfsTimetable => {
      if (!timetables.some(timetable => {
        return timetable.origin === gtfsTimetable.origin
        && timetable.destination === gtfsTimetable.destination
        && timetable.departureTime === gtfsTimetable.departureTime
      })) {
        timetables.push(gtfsTimetable)
      }
    })

    if (timetables.length === 1) return timetables[0]
    else if (timetables.length > 1) {
      let groups = timetables.map(timetable => ({
        timetable,
        directScore: findScore(timetable, stopGTFSID, departureTimeMinutes),
        distance: distance(destination, utils.getStopName(tramDestinations[utils.getDestinationName(timetable.destination)] || timetable.destination))
      }))

      return groups.sort((a, b) => {
        return a.directScore - b.directScore || a.distance - b.distance
      })[0].timetable
    }
  }

  return null
}

async function trimTripIfNeeded(db, tramDeparture, trip, stopGTFSID, day) {
  let {HeadBoardRouteNo, Destination, SpecialEventMessage} = tramDeparture
  let coreRoute = HeadBoardRouteNo.replace(/[a-z]/, '')

  if (!trip.hasBeenTrimmed) {
    if (SpecialEventMessage.includes('replace') && SpecialEventMessage.includes('trams')) {
      let mainMessage = SpecialEventMessage.replace(/.*:/, '').trim()
      let routeData = mainMessage.replace(/between.*/, '').trim()
      let routes = routeData.match(/(\d+)/g)

      let trimmedTrip
      if (routes && routes.includes(coreRoute)) {
        let stopsData = mainMessage.replace(/.*(between|from) /, '')
        let stopParts
        if (stopsData.includes('&')) stopParts = stopsData.split('&')
        else stopParts = stopsData.includes(' and ') ? stopsData.split(' and ') : stopsData.split(' to ')

        let stops = stopParts.map(stop => utils.adjustStopName(stop.replace(/Stop \w*/, '').replace(/\.$/, '').trim()))

        trimmedTrip = await trimFromMessage(db, stops, stopGTFSID, trip, day)
      }

      if (trimmedTrip) {
        return trimmedTrip
      } else {
        return await trimFromDestination(db, Destination, coreRoute, trip, day)
      }
    } else {
      return await trimFromDestination(db, Destination, coreRoute, trip, day)
    }
  }

  return trip
}

async function getDeparturesFromYT(stop, db, tripDB) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let tramTrips = tripDB.getCollection('tram trips')
  let tramStops = stop.bays.filter(b => b.mode === 'tram' && b.tramTrackerID)
  let tramTrackerIDs = tramStops.map(b => b.tramTrackerID)

  let mappedDepartures = []
  let now = utils.now()

  await async.forEach(tramStops, async bay => {
    let {stopGTFSID, tramTrackerID} = bay

    let { responseObject } = JSON.parse(await utils.request(urls.yarraStopNext3.format(tramTrackerID)))

    await async.forEach(responseObject, async tramDeparture => {
      let {Prediction, AVMTime, HeadBoardRouteNo, RunNo, Schedule, TramDistance, VehicleNo, Destination} = tramDeparture
      let scheduledTimeMS = parseInt(Schedule.slice(0, -1).match(/(\d+)\+/)[1])
      let avmTimeMS = parseInt(AVMTime.slice(0, -1).match(/(\d+)\+/)[1])

      let scheduledDepartureTime = utils.parseTime(scheduledTimeMS)
      let estimatedDepartureTime = utils.parseTime(avmTimeMS + Prediction * 1000)
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

      if (actualDepartureTime.diff(now, 'minutes') > 90) return

      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)
      let day = utils.getYYYYMMDD(scheduledDepartureTime)

      let coreRoute = HeadBoardRouteNo.replace(/[a-z]/, '')

      let routeGTFSID = `3-${coreRoute}`

      let trip = await getDeparture(db, stopGTFSID, scheduledDepartureTimeMinutes, routeGTFSID, Destination)
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

      trip = await trimTripIfNeeded(db, tramDeparture, trip, stopGTFSID, day)

      if (trip.destination === bay.fullStopName && routeGTFSID !== '3-35') return

      let loopDirection
      if (routeGTFSID === '3-35') {
        loopDirection = trip.gtfsDirection === '0' ? 'AC/W' : 'C/W'
      }

      if (tram) {
        let firstStop = trip.stopTimings[0]
        let currentStop = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
        if (!currentStop) return global.loggers.error.err(trip, stopGTFSID)
        let minutesDiff = currentStop.departureTimeMinutes - firstStop.departureTimeMinutes
        let originDepartureTime = scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

        let date = typeof trip.operationDays === 'string' ? trip.operationDays : utils.getPTYYYYMMDD(originDepartureTime)

        let query = {
          date,
          origin: trip.origin,
          destination: trip.destination,
          departureTime: trip.departureTime,
          destinationArrivalTime: trip.destinationArrivalTime
        }

        let tripData = {
          ...query,
          runID: trip.runID,
          tram: VehicleNo,
          consist: [ VehicleNo.toString() ],
          routeNumber: HeadBoardRouteNo,
          shift: RunNo.trim()
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
        tramTrackerID,
        stopGTFSID
      })
    })
  })

  return mappedDepartures.sort((a, b) => {
    return a.destination.length - b.destination.length
      || a.actualDepartureTime - b.actualDepartureTime
  })
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'tram', 90, false)
}

async function getDepartures(stop, db, tripDB) {
  try {
    let shouldShowRoad = stop.bays.filter(bay => {
      return bay.mode === 'tram'
    }).map(bay => {
      let {fullStopName} = bay
      if (fullStopName.includes('/')) {
        return fullStopName.replace(/\/\d+[a-zA-Z]? /, '/')
      } else return fullStopName
    }).filter((e, i, a) => a.indexOf(e) === i).length > 1

    return (await utils.getData('tram-departures', stop.stopName, async () => {
      try {
        return await getDeparturesFromYT(stop, db, tripDB)
      } catch (e) {
        global.loggers.general.err('Failed to get tram trips', e)
        return (await getScheduledDepartures(stop, db, false)).map(departure => {
          departure.routeNumber = determineTramRouteNumber(departure.trip)
          departure.sortNumber = departure.routeNumber.replace(/[a-z]/, '')

          return departure
        })
      }
    })).map(departure => {
      const currentStop = departure.trip.stopTimings.find(stop => stop.stopGTFSID == departure.stopGTFSID)
      if (!currentStop) return departure

      const departureRoad = (currentStop.stopName.split('/').slice(-1)[0] || '').replace(/^\d+[a-zA-Z]? /, '')
      if (shouldShowRoad && departureRoad) {
        if (departureRoad && currentStop.stopNumber) {
          departure.guidanceText = `Departing Stop #${currentStop.stopNumber} on ${departureRoad}`
        } else if (departureRoad) {
          departure.guidanceText = `Departing ${departureRoad}`
        }
      }

      return departure
    })
  } catch (e) {
    global.loggers.general.err('Failed to get scheduled tram trips', e)
    return null
  }
}

export default getDepartures
