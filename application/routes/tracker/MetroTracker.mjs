import express from 'express'
import utils from '../../../utils.mjs'
import url from 'url'
import querystring from 'querystring'
import rawLineRanges from '../../../additional-data/metro-tracker/line-ranges.mjs'

const router = new express.Router()

let lineRanges = {}

Object.keys(rawLineRanges).forEach(line => {
  let ranges = rawLineRanges[line]
  lineRanges[line] = ranges.map(range => {
    let lower = range[0]
    let upper = range[1]
    let prefix = range[2] || ''
    let numbers = []
    for (let n = lower; n <= upper; n++) {
      if (n < 1000) {
        n = utils.pad(n.toString(), prefix ? 3 : 4, '0')
      }
      numbers.push(prefix + n)
    }
    return numbers
  }).reduce((a, e) => a.concat(e), [])
})

router.get('/', (req, res) => {
  res.render('tracker/metro/index')
})

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
  let e = utils.encodeName
  let { departureTime, destinationArrivalTime } = trip
  let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime),
      destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)

  trip.url = `/metro/run/${e(trip.origin)}/${trip.departureTime}/${e(trip.destination)}/${trip.destinationArrivalTime}/${trip.date}`

  trip.departureTimeMinutes = departureTimeMinutes
  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/date', async (req, res) => {
  let { tripDB } = res
  let metroTrips = tripDB.getCollection('metro trips')

  let today = utils.getYYYYMMDDNow()
  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await metroTrips.findDocuments({ date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/metro/by-date', {
    trips,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/line', async (req, res) => {
  let { db, tripDB } = res
  let metroTrips = tripDB.getCollection('metro trips')
  let liveTimetables = db.getCollection('live timetables')

  let today = utils.getYYYYMMDDNow()
  let {date, line} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let baseLineRanges = lineRanges[line] || []

  let additionalTDNs = await liveTimetables.distinct('runID', {
    operationDays: date,
    routeName: line
  })

  let trips = (await metroTrips.findDocuments({
    date,
    runID: {
      $in: baseLineRanges.concat(additionalTDNs)
    }
  }).sort({destination: 1}).toArray())
  .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
  .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/metro/by-line', {
    trips,
    line,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/consist', async (req, res) => {
  let {tripDB} = res
  let metroTrips = tripDB.getCollection('metro trips')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await metroTrips.findDocuments({ consist, date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  let rawServicesByDay = await metroTrips.aggregate([{
    $match: {
      consist,
    }
  }, {
    $group: {
      _id: '$date',
      services: {
        $addToSet: '$runID'
      }
    }
  }, {
    $sort: {
      _id: -1
    }
  }]).toArray()

  let servicesByDay = rawServicesByDay.map(data => {
    let date = data._id
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    return {
      date,
      humanDate,
      services: data.services.sort((a, b) => a.localeCompare(b))
    }
  })

  res.render('tracker/metro/by-consist', {
    trips,
    consist,
    servicesByDay,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

export default router