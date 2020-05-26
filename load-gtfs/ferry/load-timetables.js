/*
Western port ferries tables: div#e819 div.mceTmpl > table
  > select tbody > tr
  Slice from index 2
  Stops index: [
    9000001, // stony point
    9000002, // french island
    9000003, // phillip island
    9000002, // french island
    9000001, // stony point
  ]
  For each tr, select & iterate td, building matrix sideways
  Mark * in trip
  When complete, extract trips from matrix, assign calendar dates, add to total trip list
  WEEKDAY_MF
  WEEKDAY_MFO
  SATURDAY
  SUNDAY

Westgate Punt: div#e820 div.mceTmpl > ul
Everyday 9-PMW-mjp-1.1.H: third & forth elements
Everyday 9-PMW-mjp-1.1.R: first & second elements
Calendar: EVERYDAY
Calendar_dates: exclude 20xx1225, 20xx1226, good friday (extract from public holidays.js)
From departure time: give 4min to reach opp stop

Port phillip ferries: div#e937 > table
Slice:
  2, 5: Inbound (.R)
  6, ... Outbound (.H)

Calendar:
WEEKDAY_MTue
WEEKDAY_WThuF
WEEKEND_SatSun
WEEKDAY_MTueW
WEEKDAY_ThuF
WEEKDAY_MF

*/
const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')

const cheerio = require('cheerio')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

const stops = require('./data/stops.json')

let gtfsID = 9

function loadWesternPort($) {
  let tables = Array.from($('div#e819 div.mceTmpl > table'))
  let stopsIndex = [
    9000001, // stony point
    9000002, // french island
    9000003, // phillip island
    9000002, // french island
    9000001 // stony point
  ]

  let allTripDays = ['WEEKDAY_MF', 'SATURDAY', 'SUNDAY']
  let allTrips = []
  let allTimings = []

  tables.forEach((table, i) => {
    let rows = Array.from($('tbody tr', table)).slice(2, -1)
    let tripDays = allTripDays[i]
    let tableTrips = Array($('td', rows[0]).length)
    for (let i = 0; i < tableTrips.length; i++) tableTrips[i] = []

    rows.forEach((row, y) => {
      let columns = Array.from($('td', row))
      columns.forEach((column, x) => {
        let text = $(column).text().trim()
        if (text === '-') return

        let isMFO = text.includes('*')
        if (isMFO) text = text.slice(0, -1)
        tableTrips[x].push({
          stopGTFSID: stopsIndex[y],
          departureTime: text,
          isMFO
        })
      })
    })

    let uniqueTrips = []
    tableTrips.forEach(trip => {
      let hasMFO = trip.find(stop => stop.isMFO)
      if (hasMFO) {
        let nonMFOTrip = trip.filter(stop => !stop.isMFO)
        let mfoTrip = trip

        uniqueTrips.push({
          date: 'WEEKDAY_WThuF',
          stops: nonMFOTrip
        })
        uniqueTrips.push({
          date: 'WEEKDAY_MFO',
          stops: mfoTrip
        })
      } else {
        uniqueTrips.push({
          date: tripDays,
          stops: trip
        })
      }
    })

    let tripTimings = []
    let mappedTrips = uniqueTrips.map(trip => {
      let hasPhillipIsland = trip.stops.find(stop => stop.stopGTFSID === 9000003)
      let shapeType = `9-STY-${hasPhillipIsland ? 'B' : 'A'}-mjp.1.1.H`

      let timings = []
      trip.stops.forEach((stop, i) => {
        let timingParts = stop.departureTime.match(/(\d{1,2})[.:]?(\d{1,2})?/)
        let hour = parseInt(timingParts[1])
        let minute = parseInt(timingParts[2] || '0')
        if (stop.departureTime.includes('pm')) hour += 12

        let gtfsTime = `${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}:00`

        let prev = trip.stops[i - 1]
        if (prev && prev.stopGTFSID === stop.stopGTFSID) { // phillip island twice in a row
          prev.departureTime = gtfsTime
        } else {
          timings.push({
            stopGTFSID: stop.stopGTFSID,
            arrivalTime: gtfsTime,
            departureTime: gtfsTime,
            stopConditions: {
              pickup: 0,
              dropoff: 0
            },
            stopDistance: 0,
            stopSequence: timings.length + 1,
            departureTimeMinutes: hour * 60 + minute
          })
        }
      })

      let tripID = `${timings[0].departureTimeMinutes}.${trip.date}.${shapeType}`

      tripTimings.push({ tripID, stopTimings: timings })

      return {
        mode: 'ferry',
        tripID,
        routeGTFSID: '9-STY',
        calendarID: trip.date,
        gtfsDirection: '0',
        shapeID: shapeType,
        headsign: 'Stony Point Ferry Terminal'
      }
    })

    allTrips = allTrips.concat(mappedTrips)
    allTimings = allTimings.concat(tripTimings)
  })

  return { trips: allTrips, timings: allTimings }
}

database.connect({
  poolSize: 100
}, async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  await gtfsTimetables.deleteDocuments({ gtfsMode: gtfsID })

  let totalCount = 0

  let rawCalendarDays = fs.readFileSync(path.join(__dirname, 'data', 'calendar.txt')).toString()
  let parsedCalendarDays = rawCalendarDays
    .replace(/\${START}/g, utils.getYYYYMMDDNow())
    .replace(/\${END}/g, utils.getYYYYMMDD(utils.now().add(3, 'months')))

  let calendarDays = utils.parseGTFSData(parsedCalendarDays)
  // let calendarDates = utils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())
  let calendarDates = []

  let body = await utils.request('https://www.ptv.vic.gov.au/more/travelling-on-the-network/ferries/')
  let $ = cheerio.load(body)

  let westernPortData = loadWesternPort($)
  totalCount += westernPortData.trips.length

  await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, westernPortData.trips, westernPortData.timings, calendarDays, calendarDates)

  await updateStats('ferry-timetables', totalCount)
  console.log('Completed loading in ' + totalCount + ' ferry timetables')
  process.exit()
})
