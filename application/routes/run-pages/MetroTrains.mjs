import express from 'express'
import utils from '../../../utils.mjs'
import { tripCrossesCity, checkIsCHLFormingCCLSpecialCase, getFormedByTripData, getFormingTripData } from '../../../modules/metro-trains/get-forming-trip.mjs'
import appendDoorsData from '../../../transportvic-data/sample/get-doors.mjs'

const router = new express.Router()

const MURL = [
  'Parliament',
  'Melbourne Central',
  'Flagstaff',
].map(stop => stop + ' Railway Station')

const CITY_LOOP = [
  'Parliament',
  'Melbourne Central',
  'Flagstaff',
  'Southern Cross'
].map(stop => stop + ' Railway Station')

async function pickBestTrip(data, db) {
  const operationDay = utils.parseDate(data.operationDays)
  const departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(data.departureTime)
  const tripStartTime = operationDay.clone().add(departureTimeMinutes, 'minutes')

  let originStop = await db.getCollection('stops').findDocument({
    cleanName: data.origin + '-railway-station',
    'bays.mode': 'metro train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    cleanName: data.destination + '-railway-station',
    'bays.mode': 'metro train'
  })

  if (!originStop || !destinationStop) return null

  let gtfsQuery = {
    mode: 'metro train',
    operationDays: data.operationDays,
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(gtfsQuery)
  let gtfsTrips = await db.getCollection('gtfs timetables').findDocuments(gtfsQuery).toArray()

  let gtfsTrip
  if (gtfsTrips.length > 1 && gtfsTrips.every(trip => trip.isRailReplacementBus)) {
    gtfsTrip = gtfsTrips.find(trip => trip.isMTMRailTrip) || gtfsTrips[0]
  } else gtfsTrip = gtfsTrips[0]

  let referenceTrip = liveTrip || gtfsTrip

  let needsRedirect = referenceTrip ? (referenceTrip.origin !== originStop.stopName
    || referenceTrip.destination !== destinationStop.stopName
    || referenceTrip.departureTime !== data.departureTime
    || referenceTrip.destinationArrivalTime !== data.destinationArrivalTime) : false

  if (liveTrip) return { trip: liveTrip, tripStartTime, operationDay, isLive: true, needsRedirect }
  else return gtfsTrip ? { trip: gtfsTrip, tripStartTime, operationDay, isLive: false, needsRedirect } : null
}

function tripViaCityLoop(trip) {
  return trip.stopTimings.some(stop => MURL.includes(stop.stopName))
}

function addStopTimingData(isLive, operationDay, trip) {
  let hasLiveTimings = trip.stopTimings.some(stop => stop.estimatedDepartureTime)
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''

    if (trip.cancelled || stop.cancelled) {
      stop.headwayDevianceClass = 'cancelled'

      return stop
    } else {
      stop.headwayDevianceClass = 'unknown'
    }

    if (!hasLiveTimings || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = isLive ? utils.parseTime(stop.scheduledDepartureTime) : operationDay.clone().add(stop.departureTimeMinutes, 'minutes')
      let estimatedDepartureTime = isLive ? utils.parseTime(stop.actualDepartureTimeMS) : null

      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
      if (!hasLiveTimings) return stop

      stop.headwayDevianceClass = utils.findHeadwayDeviance(scheduledDepartureTime, estimatedDepartureTime, {
        early: 0.5,
        late: 5
      })
    }
    return stop
  })
}

async function getTripData(req, res) {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return null

  let { trip, tripStartTime, operationDay, isLive, needsRedirect } = tripData

  if (needsRedirect) {
    let operationDay = utils.getYYYYMMDD(tripStartTime)
    return res.redirect(`/metro/run/${utils.encodeName(trip.origin.slice(0, -16))}/${trip.departureTime}/${utils.encodeName(trip.destination.slice(0, -16))}/${trip.destinationArrivalTime}/${operationDay}`)
  }

  addStopTimingData(isLive, operationDay, trip)
  if (!trip.isRailReplacementBus) appendDoorsData(trip) 

  let formedBy = await getFormedByTripData(trip, isLive, res.db)
  let forming = await getFormingTripData(trip, isLive, res.db)

  let showFormedBy, showForming

  if (!tripViaCityLoop(trip)) {
    if (trip.direction === 'Up' && !trip.stopTimings[trip.stopTimings.length - 1].cancelled) {
      if (forming && tripViaCityLoop(forming)) {
        showForming = forming
        showForming.stopTimings = showForming.stopTimings.filter(stop => CITY_LOOP.includes(stop.stopName) || stop.stopName === 'Flinders Street Railway Station')
      }
    } else if (trip.direction === 'Down' && !trip.stopTimings[0].cancelled) {
      if (formedBy && tripViaCityLoop(formedBy)) {
        showFormedBy = formedBy
        showFormedBy.stopTimings = showFormedBy.stopTimings.filter(stop => CITY_LOOP.includes(stop.stopName) || stop.stopName === 'Flinders Street Railway Station')
      }
    }
  } else {
    if (checkIsCHLFormingCCLSpecialCase(trip, forming)) showForming = forming
  }

  if (!showFormedBy && !showForming) {
    if (trip.direction === 'Up' && forming && tripCrossesCity(trip, forming)) showForming = forming
    else if (trip.direction === 'Down' && formedBy && tripCrossesCity(trip, formedBy)) showFormedBy = formedBy
  }

  if (showFormedBy) {
    trip.formedByTrip = showFormedBy
    addStopTimingData(isLive, operationDay, showFormedBy)
    if (!showFormedBy.isRailReplacementBus) appendDoorsData(showFormedBy)
  }

  if (showForming) {
    trip.formingTrip = showForming
    addStopTimingData(isLive, operationDay, showForming)
    if (!showForming.isRailReplacementBus) appendDoorsData(showForming)
  }

  return trip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/metro', {
    trip,
    cleanRouteName: utils.encodeName(trip.routeName)
  })
})

router.post('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await getTripData(req, res)
  if (!trip) return res.status(404).render('errors/no-trip')

  res.render('runs/templates/metro', {
    trip,
    cleanRouteName: utils.encodeName(trip.routeName)
  })
})

export default router