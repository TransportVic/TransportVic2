const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const path = require('path')
const fs = require('fs')
const querystring = require('querystring')
const modules = require('../../../modules')

const stationCodes = require('../../../additional-data/station-codes')
const rawLineRanges = require('../../../additional-data/metro-tracker/line-ranges')
const lineGroups = require('../../../additional-data/metro-tracker/line-groups')

const metroTypes = require('../../../additional-data/metro-tracker/metro-types')
const metroConsists = require('../../../additional-data/metro-tracker/metro-consists')

let stationCodeLookup = {}

Object.keys(stationCodes).forEach(stationCode => {
  stationCodeLookup[stationCodes[stationCode]] = stationCode
})

function generateQuery(type) {
  let matchedMCars = metroConsists.filter(consist => consist.type === type).map(consist => consist.leadingCar)
  return metroConsists.filter(consist => matchedMCars.includes(consist[0]))
}

let comengQuery = { $in: generateQuery('Comeng') }
let siemensQuery = { $in: generateQuery('Siemens') }
let xtrapQuery = { $in: generateQuery('Xtrapolis') }

let lineRanges = {}

let lineGroupCodes = {
  'Caulfield': 'CFD',
  'Clifton Hill': 'CHL',
  'Burnley': 'BLY',
  'Northern': 'NTH'
}

let typeCode = {
  'Direct': 'direct',
  'Via BLY Loop': 'via_BLYLoop',
  'Via NTH Loop': 'via_NTHLoop',
  'Via CHL Loop': 'via_CHLLoop',
  'Via CFD Loop': 'via_CFDLoop',
  'Via City Circle': 'via_ccl',
  'NME Via SSS Direct': 'nme_viasss'
}

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
  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime),
      destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)

  let tripDate = trip.date

  if (departureTimeMinutes < 180) {
    departureTimeMinutes += 1440
    tripDate = utils.getYYYYMMDD(utils.parseDate(tripDate).add(1, 'day'))
  }

  if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

  trip.url = `/metro/run/${e(trip.origin)}/${trip.departureTime}/${e(trip.destination)}/${trip.destinationArrivalTime}/${tripDate}`

  trip.departureTimeMinutes = departureTimeMinutes
  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/date', async (req, res) => {
  let {db} = res
  let metroTrips = db.getCollection('metro trips')

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
  let {db} = res
  let metroTrips = db.getCollection('metro trips')
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
  let {db} = res
  let metroTrips = db.getCollection('metro trips')
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
  },]).toArray()

  let servicesByDay = rawServicesByDay.map(data => {
    let date = data._id
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    return {
      date,
      humanDate,
      services: data.services
    }
  })

  res.render('tracker/metro/by-consist', {
    trips,
    consist,
    servicesByDay,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/hcmt', async (req, res) => {
  let {db} = res
  let liveTimetables = db.getCollection('live timetables')
  let today = utils.getYYYYMMDDNow()
  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = await liveTimetables.findDocuments({
    operationDays: date,
    mode: 'metro train',
    routeGTFSID: '2-PKM',
    h: true
  }).toArray()

  let e = utils.encodeName
  trips.forEach(trip => {
    let destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(trip.trueDestinationArrivalTime)
    let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(trip.departureTime)

    if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

    trip.url = `/metro/run/${e(trip.trueOrigin.slice(0, -16))}/${trip.trueDepartureTime}/${e(trip.trueDestination.slice(0, -16))}/${trip.trueDestinationArrivalTime}/${date}`
    trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today
    trip.departureTimeMinutes = departureTimeMinutes
  })

  res.render('tracker/metro/hcmt', {
    trips: trips.sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes),
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/bot', async (req, res) => {
  let {db} = res
  let metroTrips = db.getCollection('metro trips')

  res.header('Access-Control-Allow-Origin', '*')

  let search = querystring.parse(url.parse(req.url).query)
  let {runID, consist, date} = search

  let trips = []

  if (runID) {
    trips = await metroTrips.findDocuments({
      date,
      runID
    }).sort({departureTime: 1}).toArray()
  } else if (consist) {
    trips = await metroTrips.findDocuments({
      date,
      consist
    }).sort({departureTime: 1}).toArray()
  }

  let extraData = {}

  if (consist && !trips.length) {
    extraData.lastSeen = (await metroTrips.distinct('date', { consist })).slice(-1)[0]
  }

  if (modules.metroLogger) {
    let metroLogger = db.getCollection('metro logs')
    await metroLogger.createDocument({
      utc: +new Date(),
      search,
      result: trips[0],
      referer: req.headers['referer'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    })
  }

  res.json({
    trips: trips.map(adjustTrip).map(trip => {
      trip.originCode = stationCodeLookup[trip.origin]
      trip.destinationCode = stationCodeLookup[trip.destination]

      let runID = trip.runID
      let type = null
      let viaLoop = runID[1] > 5
      let line = Object.keys(lineRanges).find(possibleLine => {
        return lineRanges[possibleLine].includes(runID)
      })

      if (line) {
        let lineGroup = lineGroups[line]

        // Down, handles CCL too
        if (trip.destination === 'Flinders Street' || trip.origin === 'Flinders Street') {
          if (viaLoop) {
            if (lineGroup === 'City Circle') type = 'Via City Circle'
            else type = `Via ${lineGroupCodes[lineGroup]} Loop`
          } else {
            if (trip.destination === 'Southern Cross') type = 'Direct'
            else if (lineGroup === 'Northern') type = 'NME Via SSS Direct'
            else type = 'Direct'
          }

          trip.type = type
        } else trip.type = 'Direct'
      } else {
        if (!viaLoop) trip.type = 'Direct'
      }

      if (trip.type) trip.typeCode = typeCode[trip.type]

      let metroType = metroTypes.find(car => trip.consist.includes(car.leadingCar))
      if (metroType) trip.vehicleType = metroType.type

      return trip
    }).sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes),
    extraData
  })
})

router.get('/shunts', async  (req, res) => {
  let {db} = res
  let metroShunts = db.getCollection('metro shunts')

  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  res.header('Access-Control-Allow-Origin', '*')

  res.json((await metroShunts.findDocuments({
    date
  }).toArray()).map(shunt => ({
    runID: shunt.runID,
    type: shunt.type,
    forming: shunt.forming,
    toPlatform: shunt.toPlatform
  })))
})

router.get('/strange', async (req, res) => {
  let {db} = res
  let metroTrips = db.getCollection('metro trips')

  res.header('Access-Control-Allow-Origin', '*')
  res.json(await utils.getData('metro-strange', '1', async () => {
    let data = await new Promise(resolve => {
      fs.readFile(path.join(__dirname, '../../../logs/trackers/metro'), (err, data) => {
        resolve(data)
      })
    })

    let today = utils.getYYYYMMDDNow()
    let {consist, date} = querystring.parse(url.parse(req.url).query)
    if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
    else date = today

    let strangeTrains = data.toString().split('\n').filter(line => line.includes('strange'))
    .filter(line => utils.getYYYYMMDD(utils.parseTime(line.slice(14, 39))) === date)

    let trains = {}

    strangeTrains.forEach(line => {
      let train = line.slice(-29, -18)
      let runID = line.slice(-7, -3)

      if (!trains[train]) {
        trains[train] = {
          train,
          runIDs: [runID],
          time: new Date(line.slice(14, 39)).toLocaleString(),
        }
      } else {
        if (!trains[train].runIDs.includes(runID)) {
          trains[train].runIDs.push(runID)
        }
      }
    })

    await async.forEach(Object.keys(trains), async train => {
      let trip = await metroTrips.findDocument({
        runID: {
          $in: trains[train].runIDs
        },
        date
      })

      if (trip) trains[train].resolvedConsist = trip.consist.join('-')
    })

    return Object.values(trains)
  }, 1000 * 30))
})

router.get('/logs', async (req, res) => {
  let metroLogger = res.db.getCollection('metro logs')
  let today = utils.now()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.parseDate(date)
  else date = today

  let startOfDay = date.clone().startOf('day')
  let endOfDay = date.clone().endOf('day')

  res.header('Access-Control-Allow-Origin', '*')
  res.json(await metroLogger.findDocuments({
    utc: {
      $gte: +startOfDay,
      $lte: +endOfDay
    }
  }).toArray())
})

module.exports = router
