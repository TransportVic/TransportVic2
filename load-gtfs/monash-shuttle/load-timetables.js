/*
48017: Monash University Peninsula
21215: Frankston Railway Station/Fletcher Road
*/
const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadGTFSTimetables = require('../utils/load-gtfs-timetables')
const utils = require('../../utils')
const moment = require('moment')

const cheerio = require('cheerio')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

const stops = require('./data/stops.json')

let gtfsID = 12

function extractTrips($, table, tripTemplate, HstartStop, HendStop, headsigns, tripLength, filter) {
  let size = $('tbody > tr:nth-child(2) > td', table).length
  let allTrips = []
  let allTimings = []

  function getGTFSTimings(index) {
    let rows = Array.from($('tbody > tr', table)).slice(1)
    let time = $(`td:nth-child(${index + 1})`, rows.shift()).text().trim()

    let departureTimes = rows.map(row => {
      let timing = $(`td:nth-child(${index + 1})`, row).text().trim().replace(/\u00A0/g, ' ')
      if (timing) {
        let note = timing.match(/\* \((.*?)\)/)
        if (note) note = note[1]
        let parts = timing.replace(/\*.+/, '').replace(':', '.').split('.')
        let hour = 1 * parts[0]
        if (time === 'PM' && hour !== 12) hour += 12
        let minute = 1 * parts[1]

        let arrivalHour = hour
        let arrivalMinute = minute + tripLength
        if (arrivalMinute >= 60) {
          arrivalMinute -= 60
          arrivalHour++
        }

        return {
          timestamp: `${(hour < 10 ? '0' : '') + hour}:${(minute < 10 ? '0' : '') + minute}:00`,
          arrivalTimestamp: `${(arrivalHour < 10 ? '0' : '') + arrivalHour}:${(arrivalMinute < 10 ? '0' : '') + arrivalMinute}:00`,
          note,
          departureTimeMinutes: hour * 60 + minute
        }
      }
    }).filter(Boolean)

    return departureTimes
  }

  function processTimings(timings, gtfsDirection) {
    let originGTFSID, destinationGTFSID
    if (gtfsDirection === 0) {
      originGTFSID = HstartStop
      destinationGTFSID = HendStop
    } else {
      originGTFSID = HendStop
      destinationGTFSID = HstartStop
    }

    timings.forEach(departureTimeData => {
      let shapeType = `${tripTemplate.routeGTFSID}-mjp-1.1.${gtfsDirection === 0 ? 'H' : 'R'}`
      let tripID = `${departureTimeData.departureTimeMinutes}.${tripTemplate.calendarID}.${shapeType}`

      allTrips.push({
        ...tripTemplate,
        tripID,
        gtfsDirection: gtfsDirection.toString(),
        shapeID: shapeType,
        headsign: headsigns[gtfsDirection]
      })

      allTimings.push({
        tripID,
        stopTimings: [{
          stopGTFSID: originGTFSID,
          arrivalTime: departureTimeData.timestamp,
          departureTime: departureTimeData.timestamp,
          stopConditions: {
            pickup: 0,
            dropoff: 0
          },
          stopDistance: 0,
          stopSequence: 0
        }, {
          stopGTFSID: destinationGTFSID,
          arrivalTime: departureTimeData.arrivalTimestamp,
          departureTime: departureTimeData.arrivalTimestamp,
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

  if (size === 2) {
    let timings = []
    for (let i = 0; i <= 1; i++) {
      timings = timings.concat(getGTFSTimings(i))
    }

    for (let gtfsDirection = 0; gtfsDirection <= 1; gtfsDirection++) {
      let filtered = timings.filter(t => {
        if (filter && t.note) return filter(t.note, gtfsDirection)
        return true
      })

      processTimings(filtered, gtfsDirection)
    }
  } else {
    for (let gtfsDirection = 0; gtfsDirection <= 1; gtfsDirection++) {
      let timings = []
      for (let i = 0; i <= 1; i++) {
        timings = timings.concat(getGTFSTimings(gtfsDirection * 2 + i))
      }

      processTimings(timings, gtfsDirection)
    }
  }

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

  let body = await utils.request('https://www.monash.edu/people/transport-parking/inter-campus-shuttle-bus')
  let $ = cheerio.load(body)

  let introduction = Array.from($('#introduction_1211535 > *'))
  let operationDatesHeader = Array.from($('#introduction_1211535 > h3')).find(e => $(e).text().includes('operating dates'))

  let dates = {
    semesters: [],
    holidays: []
  }

  let calendarDays = []
  let calendarDates = []

  let weekdayPart = ['1', '1', '1', '1', '1', '0', '0']

  let operationDatesPs = introduction.slice(introduction.indexOf(operationDatesHeader) + 1)
  let lines = []
  operationDatesPs.forEach(p => {
    p = $(p)
    if (p.text().toLowerCase().includes('semester')) {
      p.html(p.html().replace(/<br>/g, '\n'))
      let text = p.text().split('\n')
      lines = lines.concat(text)
    }
  })

  let year = utils.now().year()

  lines.forEach(line => {
    let isHoliday = line.includes('Pre') || line.includes('Post')
    let parts = line.match(/(\d{1,2} \w+) to \w+,? (\d{1,2} \w+)/)
    if (!parts) return
    let startDate = parts[1] + ' ' + year
    let endDate = parts[2] + ' ' + year
    let startMoment = utils.parseTime(startDate, 'DD MMMM YYYY')
    let endMoment = utils.parseTime(endDate, 'DD MMMM YYYY')
    if (endMoment < startMoment) endMoment.add('1', 'year') // thinking about if term ends in jan
    let start = utils.getYYYYMMDD(startMoment)
    let end = utils.getYYYYMMDD(endMoment)

    let name
    if (isHoliday) {
      name = `HOLIDAY_${start.slice(4)}`
      dates.holidays.push(name)
    } else {
      name = `SEMESTER_${start.slice(4)}`
      dates.semesters.push(name)
    }
    calendarDays.push([name, ...weekdayPart, start, end])
  })

  let tables = Array.from($('.accordion table'))

  await async.forEachOf(Object.values(dates), async (calendarPeriods, i) => {
    await async.forEach(calendarPeriods, async calendarDayName => {
      let caulfieldShuttleTrips = extractTrips($, tables[i], {
        mode: 'bus',
        routeGTFSID: '12-MCC',
        calendarID: calendarDayName,
      }, 48471, 12000001, ['Monash University Caulfield', 'Monash University Clayton'], 25, (note, gtfsDirection) => {
        if (gtfsDirection === 0 && note.includes('Clayton')) return true
        if (gtfsDirection === 1 && note.includes('Caulfield')) return true
        return false
      })

      totalCount += caulfieldShuttleTrips.trips.length
      await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, caulfieldShuttleTrips.trips, caulfieldShuttleTrips.timings, calendarDays, calendarDates)
    })
  })

  await async.forEach(dates.semesters, async calendarDayName => {
    let peninsulaShuttleTrips = extractTrips($, tables[2], {
      mode: 'bus',
      routeGTFSID: '12-MCP',
      calendarID: calendarDayName,
    }, 48473, 48017, ['Monash University Peninsula', 'Monash University Clayton'], 50)

    totalCount += peninsulaShuttleTrips.trips.length
    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, peninsulaShuttleTrips.trips, peninsulaShuttleTrips.timings, calendarDays, calendarDates)
  })

  await async.forEach(dates.semesters, async calendarDayName => {
    let frankstonShuttleTrips = extractTrips($, tables[3], {
      mode: 'bus',
      routeGTFSID: '12-MPF',
      calendarID: calendarDayName,
    }, 48017, 21215, ['Frankston Railway Station', 'Monash University Peninsula'], 15)

    totalCount += frankstonShuttleTrips.trips.length
    await loadGTFSTimetables({gtfsTimetables, stops, routes}, gtfsID, frankstonShuttleTrips.trips, frankstonShuttleTrips.timings, calendarDays, calendarDates)
  })

  await updateStats('monash-shuttle-timetables', totalCount)
  console.log('Completed loading in ' + totalCount + ' monash shuttle bus timetables')
  process.exit()
})
