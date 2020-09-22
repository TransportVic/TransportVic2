const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')

const tramDestinations = require('../../../additional-data/tram-destinations')

const determineTramRouteNumber = require('../../../modules/tram/determine-tram-route-number')
const tramFleet = require('../../../tram-fleet')
const urls = require('../../../urls')

async function pickBestTrip(data, db) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required
  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440


  let stops = db.getCollection('stops')

  let originStop = await stops.findDocument({
    codedNames: data.origin,
    'bays.mode': 'tram'
  })

  let destinationStop = await stops.findDocument({
    codedNames: data.destination,
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

  if (!gtfsTrip) return null
  gtfsTrip.routeNumber = determineTramRouteNumber(gtfsTrip)

  let tramTrips = db.getCollection('tram trips')
  let tripData = await tramTrips.findDocument({
    date: operationDays,
    departureTime: gtfsTrip.departureTime,
    origin: gtfsTrip.origin,
    destination: gtfsTrip.destination
  })
  if (!tripData) return { trip: gtfsTrip, tripStartTime, isLive: false }

  let useLive = minutesToTripEnd > -20 && minutesToTripStart < 45
  if (liveTrip) {
    if (liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      return { trip: liveTrip, tripStartTime, isLive: true }
    }
  }

  let referenceTrip = liveTrip || gtfsTrip
  let {tram} = tripData
  gtfsTrip.vehicle = tram

  if (!useLive) return { trip: gtfsTrip, tripStartTime, isLive: false }

  try {
    let rawTramTimings = JSON.parse(await utils.request(urls.yarraByFleet.format(tram)))
    let tramInfo = rawTramTimings.responseObject
    let coreRoute = tramInfo.HeadBoardRouteNo.replace(/[a-z]/, '')

    let destinationArrivalTime = parseInt(tramInfo.NextPredictedStopsDetails.slice(-1)[0].PredictedArrivalDateTime.slice(0, -1).match(/(\d+)\+/)[1])
    let failed = false

    for (let predictedStop of tramInfo.NextPredictedStopsDetails) {
      let tramTrackerID = predictedStop.StopNo.toString()
      let stopData = await stops.findDocument({
        'bays.tramTrackerID': tramTrackerID
      })

      let associatedTripStop
      if (stopData) {
        let bay = stopData.bays.find(bay => bay.tramTrackerID === tramTrackerID)
        associatedTripStop = gtfsTrip.stopTimings.find(stop => stop.stopGTFSID === bay.stopGTFSID)
      } else if (!stopData && tramTrackerID > 5000) {
        associatedTripStop = gtfsTrip.stopTimings.slice(-1)[0]
      }

      if (!associatedTripStop) {
        failed = true
        break
      }
      let estimatedTimeMS = parseInt(predictedStop.PredictedArrivalDateTime.slice(0, -1).match(/(\d+)\+/)[1])
      associatedTripStop.estimatedDepartureTime = utils.parseTime(estimatedTimeMS).toISOString()
    }

    if (failed) {
      let tripDifference = tripStartTime.diff(destinationArrivalTime, 'minutes')
      if (tripDifference <= 15) {
        let stopCount = gtfsTrip.stopTimings.length
        let tripStartMinutes = gtfsTrip.stopTimings[0].departureTimeMinutes

        gtfsTrip.stopTimings = gtfsTrip.stopTimings.map((stop, i) => {
          let minutesDiff = (stop.departureTimeMinutes || stop.arrivalTimeMinutes) - tripStartMinutes
          let scheduledDepartureTime = tripStartTime.clone().add(minutesDiff, 'minutes')
          stop.estimatedDepartureTime = scheduledDepartureTime.add(tripDifference * 1 - (i / stopCount)).toISOString()
          return stop
        })

        failed = false
      }
    } else {
      gtfsTrip.routeNumber = tramInfo.HeadBoardRouteNo
    }

    let key = {
      mode: 'tram',
      routeGTFSID: gtfsTrip.routeGTFSID,
      operationDays,
      departureTime: gtfsTrip.departureTime,
      destinationArrivalTime: gtfsTrip.destinationArrivalTime,
      origin: gtfsTrip.origin
    }

    gtfsTrip.operationDays = operationDays
    gtfsTrip.type = 'timings'
    gtfsTrip.updateTime = new Date()
    delete gtfsTrip._id

    await liveTimetables.replaceDocument(key, gtfsTrip, {
      upsert: true
    })

    return  { trip: gtfsTrip, tripStartTime, isLive: !failed }
  } catch (e) {
    return  { trip: gtfsTrip, tripStartTime, isLive: false }
  }
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res, next) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  let { trip, tripStartTime, isLive } = tripData

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
    stop.prettyTimeToArrival = ''
    stop.headwayDevianceClass = 'unknown'

    if (!isLive || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
      if (stop.estimatedDepartureTime) {
        let headwayDeviance = scheduledDepartureTime.diff(stop.estimatedDepartureTime, 'minutes')

        if (headwayDeviance > 2) {
          stop.headwayDevianceClass = 'early'
        } else if (headwayDeviance <= -5) {
          stop.headwayDevianceClass = 'late'
        } else {
          stop.headwayDevianceClass = 'on-time'
        }
      }

      let actualDepartureTime = stop.estimatedDepartureTime || scheduledDepartureTime
      let timeDifference = moment.utc(moment(actualDepartureTime).diff(utils.now()))

      if (+timeDifference < -30000) return stop
      if (+timeDifference <= 60000) stop.prettyTimeToArrival = 'Now'
      else if (+timeDifference > 1440 * 60 * 1000) stop.prettyTimeToArrival = utils.getHumanDateShort(scheduledDepartureTime)
      else {
        stop.prettyTimeToArrival = ''
        if (timeDifference.get('hours')) stop.prettyTimeToArrival += timeDifference.get('hours') + ' h '
        if (timeDifference.get('minutes')) stop.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
      }
    }
    return stop
  })

  if (trip.vehicle) {
    let tramModel = tramFleet.getModel(trip.vehicle)
    trip.vehicleData = {
      name: `Tram ${tramModel}.${trip.vehicle}`
    }
  }

  let routeNumber = trip.routeNumber
  let routeNumberClass = 'tram-' + routeNumber.replace(/[a-z]/, '')

  res.render('runs/generic', {
    trip,
    shorternStopName: utils.shorternStopName,
    origin,
    destination,
    routeNumberClass,
    loopDirection,
    routeNumber
  })
})

module.exports = router
