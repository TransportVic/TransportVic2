const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')
const busDestinations = require('../../../additional-data/bus-destinations')
const busStopNameModifier = require('../../../additional-data/bus-stop-name-modifier')
const ptvAPI = require('../../../ptv-api')
const cheerio = require('cheerio')
const TimedCache = require('timed-cache')

const locationCache = new TimedCache({ defaultTtl: 1000 * 30 })

let ptvKey
let cacheTime

async function getPTVKey() {
  if (cacheTime && (new Date - cacheTime) < 1000 * 60 * 60) { // Cache key for 1hr max
    return ptvKey
  }

  let ptvData = await utils.request('https://ptv.vic.gov.au')
  let $ = cheerio.load(ptvData)
  let key = $('#fetch-key').val()

  ptvKey = key
  cacheTime = new Date()

  return key
}

function getPlaceName(routeNumber, placeName) {
  let trimmedPlaceName = placeName.replace('Shopping Centre', 'SC')

  let serviceData = busDestinations.service[routeNumber] || {}
  let a = trimmedPlaceName, b = trimmedPlaceName.split('/')[0]

  return (serviceData[a] || serviceData[b]
    || busDestinations.generic[a] || busDestinations.generic[b] || b)
}

async function getPTVRunID(now, date, trip) {
  let checkStops = trip.stopTimings.map(stopTiming => {
    stopTiming.actualDepartureTime = now.clone().startOf('day').add(stopTiming.departureTimeMinutes, 'minutes')
    return stopTiming
  }).filter(stopTiming => {
    return stopTiming.actualDepartureTime.diff(now, 'minutes') > 0
  }).slice(0, -1)

  let checkStop = checkStops[0]

  if (!checkStop) checkStop = trip.stopTimings[0]

  let checkStopTime = utils.parseTime(`${date} ${checkStop.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartTime = utils.parseTime(`${date} ${trip.departureTime}`, 'YYYYMMDD HH:mm')
  let isoDeparture = checkStopTime.toISOString()

  let {departures, runs} = await ptvAPI(`/v3/departures/route_type/2/stop/${checkStop.stopGTFSID}?gtfs=true&date_utc=${tripStartTime.clone().add(-3, 'minutes').startOf('minute').toISOString()}&max_results=5&expand=run&expand=stop`)

  let departure = departures.filter(departure => {
    let run = runs[departure.run_id]
    let destinationName = busStopNameModifier(utils.adjustStopName(run.destination_name.trim()))
      .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')
    let scheduledDepartureTime = moment(departure.scheduled_departure_utc).toISOString()

    return scheduledDepartureTime === isoDeparture &&
      destinationName === trip.destination
  })[0]

  if (!departure) return {}
  return {
    ptvRunID: departure.run_id,
    ptvStopID: departure.stop_id,
    isoDeparture
  }
}

router.get('/', async (req, res) => {
  res.render('tracker/bus/locator')
  await getPTVKey() // For preloading purposes
})

router.post('/', async (req, res) => {
  await getPTVKey()

  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let now = utils.now()
  let date = utils.getYYYYMMDD(now)
  let {fleet} = querystring.parse(url.parse(req.url).query)
  if (!fleet) {
    return res.json({ error: 'no fleet number' })
  }

  let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
  let query = { date }

  let smartrakID

  if (bus) {
    smartrakID = bus.smartrakID
    fleet = `#${fleet}`
  } else {
    smartrakID = parseInt(fleet) || '?'
    bus = await smartrakIDs.findDocument({ smartrakID })
    if (bus) {
      fleet = `#${bus.fleetNumber}`
    } else {
      fleet = `@${smartrakID}`
    }
  }

  query.smartrakID = smartrakID
  let tripsToday = await busTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  let activeTrips = tripsToday.filter(trip => {
    let {departureTime, destinationArrivalTime} = trip
    let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime)
    let destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)
    if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

    return minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  let currentTrip = activeTrips[0]
  let nextActiveTripDescriptor = activeTrips[1] || currentTrip // Prefer next one
  if (!currentTrip) return res.json({ error: 'bus not found on network' })

  let tripID = `${date}${nextActiveTripDescriptor.routeGTFSID}${nextActiveTripDescriptor.origin}${ nextActiveTripDescriptor.destination}${nextActiveTripDescriptor.departureTime}${nextActiveTripDescriptor.destinationArrivalTime}`

  let cachedLocation
  if ((cachedLocation = locationCache.get(tripID))) return res.json(cachedLocation)

  let nextActiveTrip = await gtfsTimetables.findDocument({
    mode: 'bus',
    operationDays: date,
    routeGTFSID: nextActiveTripDescriptor.routeGTFSID,
    origin: nextActiveTripDescriptor.origin,
    destination: nextActiveTripDescriptor.destination,
    departureTime: nextActiveTripDescriptor.departureTime,
    destinationArrivalTime: nextActiveTripDescriptor.destinationArrivalTime,
  })

  let {ptvRunID, ptvStopID, isoDeparture} = await getPTVRunID(now, date, nextActiveTrip)
  if (ptvRunID) {
    let url = `https://www.ptv.vic.gov.au/lithe/patterns?run=${ptvRunID}&route_type=2&date_utc=${isoDeparture}&stop_id=${ptvStopID}&__tok=${ptvKey}`
    let data = JSON.parse(await utils.request(url))

    let runData = data.departures[0].run
    let vehiclePosition = runData.vehicle_position

    if (vehiclePosition) {
      let location = {
        lat: vehiclePosition.latitude,
        lng: vehiclePosition.longitude,
        bearing: vehiclePosition.bearing,
        departureTime: currentTrip.departureTime,
        routeNumber: currentTrip.routeNumber,
        destination: getPlaceName(currentTrip.routeNumber, currentTrip.destination),
        fleetNumber: fleet
      }

      locationCache.put(tripID, location)
      return res.json(location)
    }
  }

  return res.json({ error: 'could not locate trip' })
})

module.exports = router
