import async from 'async'
import express from 'express'
import utils from '../../../utils.mjs'
import url from 'url'
import querystring from 'querystring'
import vlineFleet from '../../../additional-data/vline-tracker/vline-fleet.json' with { type: 'json' }
import vlineConsists from '../../../additional-data/vline-tracker/carriage-sets.json' with { type: 'json' }
import rawLineRanges from '../../../additional-data/vline-tracker/line-ranges.mjs'
import { getDayOfWeek } from '../../../public-holidays.mjs'

const router = new express.Router()

let lineRanges = {}

Object.keys(rawLineRanges).forEach(line => {
  let ranges = rawLineRanges[line]

  lineRanges[line] = ranges.map(range => {
    let lower = range[0]
    let upper = range[1]

    let numbers = []
    for (let n = lower; n <= upper; n++) {
      numbers.push(n.toString())
    }
    return numbers
  }).reduce((a, e) => a.concat(e), [])
})

router.get('/', (req, res) => {
  res.render('tracker/vline/index')
})

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
  let e = utils.encodeName
  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime),
      destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)

  let tripDate = trip.date

  if (departureTimeMinutes < 180) {
    departureTimeMinutes += 1440
    tripDate = utils.getYYYYMMDD(utils.parseDate(tripDate).add(1, 'day'))
  }
  if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

  trip.url = `/vline/run/${e(trip.origin)}-railway-station/${trip.departureTime}/${e(trip.destination)}-railway-station/${trip.destinationArrivalTime}/${tripDate}`

  trip.departureTimeMinutes = departureTimeMinutes
  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/date', async (req, res) => {
  let { tripDB } = res
  let vlineTrips = tripDB.getCollection('vline trips')

  let today = utils.getYYYYMMDDNow()
  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await vlineTrips.findDocuments({ date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/vline/by-date', {
    trips,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/line', async (req, res) => {
  let { tripDB } = res
  let vlineTrips = tripDB.getCollection('vline trips')

  let today = utils.getYYYYMMDDNow()
  let {date, line} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let baseLineRanges = lineRanges[line] || []

  let trips = (await vlineTrips.findDocuments({
    date,
    runID: {
      $in: baseLineRanges
    }
  }).sort({destination: 1}).toArray())
  .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
  .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/vline/by-line', {
    trips,
    line,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/consist', async (req, res) => {
  let { tripDB } = res
  let vlineTrips = tripDB.getCollection('vline trips')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await vlineTrips.findDocuments({ consist, date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  let operationDays = (await vlineTrips.distinct('date', { consist })).slice(-60)
  let servicesByDay = {}

  let allDays = []

  await async.forEach(operationDays, async date => {
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)
    allDays.push(humanDate)

    servicesByDay[humanDate] = {
      services: (await vlineTrips.distinct('runID', {
        consist, date
      })).sort((a, b) => a - b),
      date
    }
  })

  res.render('tracker/vline/by-consist', {
    trips,
    consist,
    allDays,
    servicesByDay,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

async function filterHighlights(date, allTrips, db) {
  let nspTimetables = db.getCollection('timetables')
  let dayOfWeek = await getDayOfWeek(date)

  let doubleHeaders = allTrips.filter(trip => {
    return trip.consist[1] && trip.consist[0].match(/^[ANP]\d{2,3}$/) && trip.consist[1].match(/^[ANP]\d{2,3}$/)
  })

  let timetables = {}
  await async.forEach(allTrips, async trip => {
    timetables[trip.runID] = await nspTimetables.findDocument({
      runID: trip.runID,
      operationDays: dayOfWeek
    })
  })

  let unknownTrips = allTrips.filter(trip => !timetables[trip.runID])

  let consistTypeChanged = allTrips.filter(trip => {
    let nspTimetable = timetables[trip.runID]

    if (nspTimetable) {
      let tripVehicleType
      if (trip.consist[0].startsWith('VL')) tripVehicleType = 'VL'
      else if (trip.consist[0].startsWith('70')) tripVehicleType = 'SP'
      else {
        let locos = trip.consist.filter(car => car.match(/^[ANP]\d{2,3}$/))
        let powerVan = trip.consist.find(car => car.match(/^P[CHZ]J?\d{3}$/))
        let setVehicles = trip.consist.filter(car => !locos.includes(car) && car !== powerVan)

        if (locos[0]) tripVehicleType = locos[0][0] + ' +'

        if (setVehicles.length) tripVehicleType += setVehicles[0].includes('N') ? 'N' : 'H'
        else return true
      }

      let nspTripType = nspTimetable.vehicle
      if (nspTripType.endsWith('+PCJ')) nspTripType = nspTripType.slice(0, -4)

      let vlMatch = (nspTripType.includes('VL') || nspTripType.includes('VR')) && tripVehicleType == 'VL'
      let spMatch = nspTripType.includes('SP') && tripVehicleType == 'SP'

      if (vlMatch || spMatch) return false
      if (nspTripType.match(/^[ANP]/) && tripVehicleType.match(/^[ANP]/)) {
        return tripVehicleType.slice(-1) !== nspTripType.slice(-1)
      }

      return true
    }
  })

  let oversizeConsist = allTrips.filter(trip => {
    // We're only considering where consist type wasnt changed. otherwise 1xVL and 2xSP would trigger even though its equiv
    if (consistTypeChanged.includes(trip)) return false
    if (['8118', '8116', '8160', '8158'].includes(trip.runID)) return false

    let nspTimetable = timetables[trip.runID]

    if (nspTimetable && !nspTimetable.flags.tripAttaches) {
      let tripVehicleType
      let nspTripType = nspTimetable.vehicle
      let consistSize = trip.consist.length
      let nspConsistSize = parseInt(nspTripType[0])
      if (nspTripType === '3VL') nspConsistSize = 1

      if (!trip.consist[0].match(/^[ANP]\d{2,3}$/)) {
        return consistSize > nspConsistSize
      }
    }
  })

  let setAltered = allTrips.filter(trip => {
    if (!trip.consist[0].match(/^[ANP]\d{2,3}$/)) return false

    let {consist, set} = trip
    if (!set) return false // If only a loco was assigned don't trigger it

    let individualSets = set.split(' ')
    let combinedKnownSets = []

    for (let setName of individualSets) {
      let knownSet = vlineConsists[setName]
      if (!knownSet) return true // We don't recognise the set, mark as set altered
      combinedKnownSets = combinedKnownSets.concat(knownSet)
    }

    let locos = trip.consist.filter(car => car.match(/^[ANP]\d{2,3}$/))
    let powerVan = trip.consist.find(car => car.match(/^P[CHZ]J?\d{3}$/))
    let setVehicles = trip.consist.filter(car => !locos.includes(car) && car !== powerVan)

    if (combinedKnownSets.some(known => !setVehicles.includes(known))) return true
    if (setVehicles.some(car => !combinedKnownSets.includes(car))) return true
  })

  let unknownVehicle = allTrips.filter(trip => {
    return trip.consist.some(c => !vlineFleet.includes(c))
  })

  return {
    doubleHeaders,
    consistTypeChanged,
    oversizeConsist,
    setAltered,
    unknownVehicle,
    unknownTrips
  }
}

router.get('/highlights', async (req, res) => {
  let { tripDB } = res
  let vlineTrips = tripDB.getCollection('vline trips')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)

  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let dateMoment = utils.parseDate(date)

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let allTrips = (await vlineTrips.findDocuments({ date })
    .sort({destination: 1}).toArray())
    .filter(trip => !!trip.consist[0])
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  let highlightData = await filterHighlights(dateMoment, allTrips, db)

  res.render('tracker/vline/highlights', {
    ...highlightData,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

export default router