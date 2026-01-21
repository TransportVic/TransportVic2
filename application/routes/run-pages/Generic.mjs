// TODO: Move bus to its own page handler

import express from 'express'
import utils from '../../../utils.mjs'
import coachDestinations from '../../../additional-data/coach-stops.mjs'
import busBays from '../../../additional-data/bus-data/bus-bays.mjs'

const router = new express.Router()

async function pickBestTrip(data, db) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)

  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440
  if (tripStartMinutes >= 1440) tripDay.add(-1, 'day')
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required

  let dbStops = db.getCollection('stops')

  let trueMode = data.mode
  if (trueMode === 'coach') trueMode = 'regional coach'
  if (trueMode === 'heritage') trueMode = 'heritage train'

  let possibleOriginStops = await dbStops.findDocuments({
    cleanNames: data.origin,
    'bays.mode': trueMode
  }).toArray()

  let possibleDestinationStops = await dbStops.findDocuments({
    cleanNames: data.destination,
    'bays.mode': trueMode
  }).toArray()

  if (!possibleOriginStops.length || !possibleDestinationStops.length) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let originBay = possibleOriginStops.map(stop => stop.bays.find(bay => utils.encodeName(bay.fullStopName) === data.origin)).find(bay => bay)
  let destinationBay = possibleDestinationStops.map(stop => stop.bays.find(bay => utils.encodeName(bay.fullStopName) === data.destination)).find(bay => bay)

  let originStop = possibleOriginStops.find(stop => stop.bays.includes(originBay))

  let operationDays = utils.getYYYYMMDD(tripDay)

  let query = {
    mode: trueMode,
    origin: originBay.fullStopName,
    departureTime: data.departureTime,
    destination: destinationBay.fullStopName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays
  }

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)
  let liveTrip = await db.getCollection('live timetables').findDocument(query)

  let referenceTrip = liveTrip || gtfsTrip

  return referenceTrip ? { tripStartTime, trip: referenceTrip } : null
}

async function getTripData(req, res) {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return null

  let { trip, tripStartTime } = tripData

  let operator = ''

  let {destination, origin} = trip
  let fullDestination = destination
  let fullOrigin = origin

  let destinationShortName = utils.getStopName(destination)
  let originShortName = utils.getStopName(origin)

  if (!utils.isStreet(destinationShortName)) destination = destinationShortName
  if (!utils.isStreet(originShortName)) origin = originShortName

  destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')
  origin = origin.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

  if (trip.mode === 'regional coach') {
    origin = coachDestinations(trip.stopTimings[0])
    destination = coachDestinations(trip.stopTimings.slice(-1)[0])

    let destShortName = utils.getStopName(destination)
    if (!utils.isStreet(destShortName)) destination = destShortName

    let originShortName = utils.getStopName(origin)
    if (!utils.isStreet(originShortName)) origin = originShortName
  }

  let firstDepartureTime = trip.stopTimings[0].departureTimeMinutes

  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''
    stop.headwayDevianceClass = 'unknown'

    let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
    stop.pretyTimeToDeparture = utils.prettyTime(scheduledDepartureTime, true, true)

    stop.bay = busBays[stop.stopGTFSID]

    return stop
  })

  return {
    trip,
    origin,
    destination
  }
}

router.get('/:mode/run/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res, next) => {
  if (!['coach', 'ferry', 'heritage'].includes(req.params.mode)) return next()

  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/generic', {
    ...trip,
    shorternStopName: utils.shorternStopName
  })
})

router.post('/:mode/run/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res, next) => {
  if (!['coach', 'ferry', 'heritage'].includes(req.params.mode)) return next()

  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/templates/generic', {
    ...trip,
    shorternStopName: utils.shorternStopName
  })
})

export default router