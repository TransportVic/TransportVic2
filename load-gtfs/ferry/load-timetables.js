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
const config = require('../../config')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')

const cheerio = require('cheerio')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

const stops = require('./data/stops')

let gtfsID = 9

function loadWesternPort($) {
  let tables = Array.from($('div#e819 div.mceTmpl > table'))
  let stopsIndex = [
    "9000001", // stony point
    "9000002", // french island
    "9000003", // phillip island
    "9000002", // french island
    "9000001" // stony point
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
      let frenchIslandCount = trip.stops.filter(stop => stop.stopGTFSID === '9000002').length
      let hasPhillipIsland = trip.stops.some(stop => stop.stopGTFSID === '9000003')

      let routeVariant
      if (frenchIslandCount === 1 && !hasPhillipIsland) routeVariant = 'A'
      else if (frenchIslandCount === 2 && hasPhillipIsland) routeVariant = 'B'
      else if (frenchIslandCount === 0 && hasPhillipIsland) routeVariant = 'C'
      else routeVariant = 'D' // Not currently used

      let shapeType = `9-STY-${routeVariant}-mjp-1.1.H`

      let timings = []
      trip.stops.forEach((stop, i) => {
        let timingParts = stop.departureTime.match(/(\d{1,2})[.:]?(\d{1,2})?/)
        let hour = parseInt(timingParts[1])
        let minute = parseInt(timingParts[2] || '0')
        if (stop.departureTime.includes('pm') && hour !== 12) hour += 12

        let gtfsTime = `${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}:00`

        let prev = trip.stops[i - 1]
        if (prev && prev.stopGTFSID === stop.stopGTFSID) { // phillip island twice in a row
          timings[i - 1].departureTime = gtfsTime
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

function loadWestgatePunt($) {
  let lists = Array.from($('div#e820 div.mceTmpl > ul'))
  let hTrips = [lists[2], lists[3]].reduce((a, e) => a.concat(Array.from($('li', e)).map(f => $(f).text())), [])
  let rTrips = [lists[0], lists[1]].reduce((a, e) => a.concat(Array.from($('li', e)).map(f => $(f).text())), [])

  let allTrips = []
  let allTimings = []

  function processTrips(departureTimes, headsign, gtfsDirection) {
    let shapeType = `9-PMW-mjp-1.1.${gtfsDirection === '0' ? 'H' : 'R'}`

    departureTimes.forEach(departureTime => {
      let timingParts = departureTime.match(/(\d{1,2})[.:]?(\d{1,2})?/)
      let hour = parseInt(timingParts[1])
      let minute = parseInt(timingParts[2] || '0')
      if (departureTime.includes('pm') && hour !== 12) hour += 12
      let departureTimeMinutes = hour * 60 + minute

      let departureGTFSTime = `${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}:00`

      let arrivalHour = hour, arrivalMinute = minute
      arrivalMinute += 4
      if (arrivalMinute >= 60) {
        arrivalMinute %= 60
        arrivalHour++
      }

      let arrivalGTFSTime = `${arrivalHour < 10 ? '0' + arrivalHour : arrivalHour}:${arrivalMinute < 10 ? '0' + arrivalMinute : arrivalMinute}:00`
      let tripID = `${departureTimeMinutes}.WEEKDAY_MF.${shapeType}`

      allTrips.push({
        mode: 'ferry',
        tripID,
        routeGTFSID: '9-PMW',
        calendarID: 'WEEKDAY_MF',
        gtfsDirection,
        shapeID: shapeType,
        headsign
      })

      let originGTFSID, destinationGTFSID
      if (gtfsDirection === '0') { // port melbourne - spotwood
        originGTFSID = "9000004"
        destinationGTFSID = "9000005"
      } else {
        originGTFSID = "9000005"
        destinationGTFSID = "9000004"
      }

      allTimings.push({
        tripID,
        stopTimings: [{
          stopGTFSID: originGTFSID,
          arrivalTime: departureGTFSTime,
          departureTime: departureGTFSTime,
          stopConditions: {
            pickup: 0,
            dropoff: 0
          },
          stopDistance: 0,
          stopSequence: 0
        }, {
          stopGTFSID: destinationGTFSID,
          arrivalTime: arrivalGTFSTime,
          departureTime: arrivalGTFSTime,
          stopConditions: {
            pickup: 0,
            dropoff: 0
          },
          stopDistance: 0,
          stopSequence: 0
        }]
      })
    })
  }

  processTrips(hTrips, 'Spotswood Ferry Terminal', '0')
  processTrips(rTrips, 'Port Melbourne Ferry Terminal', '1')

  return { trips: allTrips, timings: allTimings }
}

function loadPortPhillip($) {
  let tables = Array.from($('div#e937 table'))

  let dayType = {
    'Monday to Wednesday': 'WEEKDAY_MTueW',
    'Thursday and Friday': 'WEEKDAY_ThuF',

    'Monday and Tuesday': 'WEEKDAY_MTue',
    'Wednesday to Friday': 'WEEKDAY_WThuF',

    'Saturday and Sunday': 'WEEKEND_SatSun',
    'Monday to Friday': 'WEEKDAY_MF'
  }

  let geelongDocklands = tables[0]
  let docklandsGeelong = tables[1]

  let portarlingtonDocklands = tables[2]
  let docklandsPortarlington = tables[3]

  function getGTFSTime(time) {
    let timingParts = time.match(/(\d{1,2})[.:]?(\d{1,2})?/)
    let hour = parseInt(timingParts[1])
    let minute = parseInt(timingParts[2] || '0')
    if (time.includes('pm') && hour !== 12) hour += 12
    return `${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}:00`
  }

  let allTrips = [], allTimings = []

  function processTrips(table, outHeadsign, routeGTFSID, outStopGTFSID) {
    let rows = Array.from($('tr', table)).slice(2)
    let gtfsDirection = outHeadsign ? '0' : '1'
    rows.forEach((row, i) => {
      let cells = Array.from($('td', row)).map(e => $(e).text())
      let calendarType = dayType[cells[0]]

      let timings = cells.slice(1).map(e => getGTFSTime(e))
      let headsign = outHeadsign || 'Docklands Ferry Terminal'
      let departureTimeParts = timings[0].split(':')
      let departureTimeMinutes = departureTimeParts[0] * 60 + departureTimeParts[1] * 1

      let shapeType = `9-${routeGTFSID}-mjp-1.1.${gtfsDirection === '0' ? 'H' : 'R'}`
      let tripID = `${departureTimeMinutes}.${calendarType}.${shapeType}`

      allTrips.push({
        mode: 'ferry',
        tripID,
        routeGTFSID: `9-${routeGTFSID}`,
        calendarID: calendarType,
        gtfsDirection,
        shapeID: shapeType,
        headsign
      })

      let originGTFSID, destinationGTFSID
      if (gtfsDirection === '0') { // docklands - destination
        originGTFSID = "9000006"
        destinationGTFSID = outStopGTFSID
      } else {
        originGTFSID = outStopGTFSID
        destinationGTFSID = "9000006"
      }

      allTimings.push({
        tripID,
        stopTimings: [{
          stopGTFSID: originGTFSID,
          arrivalTime: timings[0],
          departureTime: timings[0],
          stopConditions: {
            pickup: 0,
            dropoff: 0
          },
          stopDistance: 0,
          stopSequence: 0
        }, {
          stopGTFSID: destinationGTFSID,
          arrivalTime: timings[1],
          departureTime: timings[1],
          stopConditions: {
            pickup: 0,
            dropoff: 0
          },
          stopDistance: 0,
          stopSequence: 0
        }]
      })
    })
  }

  processTrips(docklandsPortarlington, 'Portarlington Ferry Terminal', 'PPO', "9000007")
  processTrips(portarlingtonDocklands, null, 'PPO', "9000007")

  processTrips(docklandsGeelong, 'Geelong Ferry Terminal', 'PGL', "9000008")
  processTrips(geelongDocklands, null, 'PGL', "9000008")

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

  let calendarDays = gtfsUtils.parseGTFSData(parsedCalendarDays)
  // let calendarDates = gtfsUtils.parseGTFSData(fs.readFileSync(path.join(gtfsPath, 'calendar_dates.txt')).toString())
  let calendarDates = []

  let body = await utils.request('https://www.ptv.vic.gov.au/more/travelling-on-the-network/ferries/')
  let $ = cheerio.load(body)

  try {
    let westernPortData = loadWesternPort($)

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, westernPortData.trips, westernPortData.timings, calendarDays, calendarDates)
    totalCount += westernPortData.trips.length
  } catch (e) {
    console.log('Failed to load Western Port data')
    console.log(e)
  }

  try {
    let westgatePunt = loadWestgatePunt($)

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, westgatePunt.trips, westgatePunt.timings, calendarDays, calendarDates)
    totalCount += westgatePunt.trips.length
  } catch (e) {
    console.log('Failed to load Westgate Punt data')
    console.log(e)
  }

  try {
    let portPhillip = loadPortPhillip($)

    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, portPhillip.trips, portPhillip.timings, calendarDays, calendarDates)
    totalCount += portPhillip.trips.length
  } catch (e) {
    console.log('Failed to load Port Phillip Ferries data')
    console.log(e)
  }

  await updateStats('ferry-timetables', totalCount)
  console.log('Completed loading in ' + totalCount + ' ferry timetables')
  process.exit()
})
