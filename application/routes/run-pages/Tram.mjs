import express from 'express'
import utils from '../../../utils.mjs'
import tramDestinations from '../../../additional-data/tram-destinations.json' with { type: 'json' }
import determineTramRouteNumber from '../../../modules/tram/determine-tram-route-number.js'
import tramFleet from '../../../additional-data/tram-tracker/tram-fleet.js'
import urls from '../../../urls.json' with { type: 'json' }

const router = new express.Router()

async function pickBestTrip(data, db, tripDB) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required
  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440

  let stops = db.getCollection('stops')

  let originStop = await stops.findDocument({
    cleanNames: data.origin,
    'bays.mode': 'tram'
  })

  let destinationStop = await stops.findDocument({
    cleanNames: data.destination,
    'bays.mode': 'tram'
  })
  if (!originStop || !destinationStop) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let originName = originStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.origin)[0].fullStopName
  let destinationName = destinationStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.destination)[0].fullStopName

  let operationDays = data.operationDays
  if (tripStartMinutes > 1440) operationDays = utils.getYYYYMMDD(tripDay.clone().add(-1, 'day'))

  let query = {
    mode: 'tram',
    origin: originName,
    departureTime: data.departureTime,
    destination: destinationName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays
  }

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  let gtfsTrip = await gtfsTimetables.findDocument(query)
  let liveTrip = await liveTimetables.findDocument(query)

  let referenceTrip = liveTrip || gtfsTrip

  if (!referenceTrip) return null

  let tramTrips = tripDB.getCollection('tram trips')
  let tripData = await tramTrips.findDocument({
    date: data.operationDays,
    departureTime: referenceTrip.departureTime,
    origin: referenceTrip.origin,
    destination: referenceTrip.destination
  })

  if (!tripData) {
    referenceTrip.routeNumber = determineTramRouteNumber(referenceTrip)
    return { trip: referenceTrip, tripStartTime, isLive: false, shift: null }
  } else {
    referenceTrip.routeNumber = tripData.routeNumber
  }

  let useLive = minutesToTripEnd > -20 && minutesToTripStart < 45
  if (liveTrip) {
    if (liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      return { trip: liveTrip, tripStartTime, isLive: true, shift: tripData.shift }
    }
  }

  let {tram} = tripData
  referenceTrip.vehicle = tram

  if (!useLive) return { trip: referenceTrip, tripStartTime, isLive: false, shift: tripData.shift }

  try {
    let rawTramTimings = JSON.parse(await utils.request(urls.yarraByFleet.format(tram)))
    let tramInfo = rawTramTimings.responseObject

    let isLayover = tramInfo.AtLayover

    let destinationArrivalTime = parseInt(tramInfo.NextPredictedStopsDetails.slice(-1)[0].PredictedArrivalDateTime.slice(0, -1).match(/(\d+)\+/)[1])
    let failed = tramInfo.NextPredictedStopsDetails.length === 1

    if (!isLayover) {
      for (let predictedStop of tramInfo.NextPredictedStopsDetails) {
        let tramTrackerID = predictedStop.StopNo.toString()
        let stopData = await stops.findDocument({
          'bays.tramTrackerID': tramTrackerID
        })

        let associatedTripStop
        if (stopData) {
          let bay = stopData.bays.find(bay => bay.tramTrackerID === tramTrackerID)
          associatedTripStop = referenceTrip.stopTimings.find(stop => stop.stopGTFSID === bay.stopGTFSID)
        } else if (!stopData && tramTrackerID > 5000) {
          associatedTripStop = referenceTrip.stopTimings.slice(-1)[0]
        }

        if (!associatedTripStop) {
          // failed = true
          continue
        }
        let estimatedTimeMS = parseInt(predictedStop.PredictedArrivalDateTime.slice(0, -1).match(/(\d+)\+/)[1])
        associatedTripStop.estimatedDepartureTime = utils.parseTime(estimatedTimeMS).toISOString()
      }
    }

    if (failed || isLayover) {
      let tripDifference = tripStartTime.diff(destinationArrivalTime, 'minutes')
      if (isLayover) tripDifference = 0

      if (tripDifference <= 15) {
        let stopCount = referenceTrip.stopTimings.length
        let tripStartMinutes = referenceTrip.stopTimings[0].departureTimeMinutes

        referenceTrip.stopTimings = referenceTrip.stopTimings.map((stop, i) => {
          let minutesDiff = (stop.departureTimeMinutes || stop.arrivalTimeMinutes) - tripStartMinutes
          let scheduledDepartureTime = tripStartTime.clone().add(minutesDiff, 'minutes')
          stop.estimatedDepartureTime = scheduledDepartureTime.add(tripDifference * 1 - (i / stopCount)).toISOString()
          return stop
        })

        failed = false
      }
    }

    let key = {
      mode: 'tram',
      operationDays,
      runID: referenceTrip.runID
    }

    referenceTrip.operationDays = operationDays
    referenceTrip.type = 'timings'
    referenceTrip.updateTime = new Date()
    delete referenceTrip._id
    referenceTrip.runID = Math.random()

    await liveTimetables.replaceDocument(key, referenceTrip, {
      upsert: true
    })

    return  { trip: referenceTrip, tripStartTime, isLive: !failed, shift: tripData.shift }
  } catch (e) {
    return  { trip: referenceTrip, tripStartTime, isLive: false, shift: tripData.shift }
  }
}

async function getTripData(req, res) {
  let tripData = await pickBestTrip(req.params, res.db, res.tripDB)
  if (!tripData) return null

  let { trip, tripStartTime, isLive, shift } = tripData

  let routes = res.db.getCollection('routes')
  let tripRoute = await routes.findDocument({ routeGTFSID: trip.routeGTFSID }, { routePath: 0 })
  let operator = tripRoute.operators[0]

  let {destination, origin} = trip
  let fullDestination = destination
  let fullOrigin = origin

  let destinationShortName = utils.getStopName(destination)
  let originShortName = utils.getStopName(origin)

  if (!utils.isStreet(destinationShortName)) destination = destinationShortName
  if (!utils.isStreet(originShortName)) origin = originShortName

  destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')
  origin = origin.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

  destination = tramDestinations[destination] || destination
  origin = tramDestinations[origin] || origin

  let loopDirection
  if (trip.routeGTFSID === '3-35') {
    loopDirection = trip.gtfsDirection === '0' ? 'AC/W' : 'C/W'
  }

  let firstDepartureTime = trip.stopTimings[0].departureTimeMinutes
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''
    stop.headwayDevianceClass = 'unknown'

    if (!isLive || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
      let estimatedDepartureTime = stop.estimatedDepartureTime

      stop.headwayDevianceClass = utils.findHeadwayDeviance(scheduledDepartureTime, estimatedDepartureTime, {
        early: 2,
        late: 5
      })

      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
    }
    return stop
  })

  if (trip.vehicle) {
    let tramModel = tramFleet.getModel(trip.vehicle)
    trip.vehicleData = {
      name: `Tram ${tramModel}.${trip.vehicle} (${shift})`,
      model: tramModel
    }
  }

  let routeNumber = trip.routeNumber
  let routeNumberClass = 'tram-' + routeNumber.replace(/[a-z]/, '')

  return {
    trip,
    origin,
    destination,
    routeNumberClass,
    loopDirection,
    routeNumber
  }
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/generic', {
    ...trip,
    shorternStopName: utils.shorternStopName
  })
})

router.post('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/templates/generic', {
    ...trip,
    shorternStopName: utils.shorternStopName
  })
})

export default router