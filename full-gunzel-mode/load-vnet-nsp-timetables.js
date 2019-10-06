const config = require('../config.json')

const fs = require('fs')
const parseCSV = require('csv-parse')
const async = require('async')

function operatingDaysToArray (days) {
  days = days.replace(/ /g, '').replace(/&/g, ',')
  if (days === 'M-F') return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri']
  if (days === 'M,W') return ['Mon', 'Wed']
  if (days === 'M,W,F') return ['Mon', 'Wed', 'Fri']
  if (days === 'W,F') return ['Wed', 'Fri']
  if (days === 'Tu,Th') return ['Tues', 'Thur']
  if (days === 'Sat' || days === 'Saturday') return ['Sat']
  if (days === 'Sun' || days === 'SuO' || days === 'Sunday') return ['Sun']
  if (days === 'Sat+Sun' || days === 'Sun+Sat') return ['Sat', 'Sun']
  if (days === 'ME') return ['Tues', 'Wed', 'Thur', 'Fri']
  if (days === 'MO' || days === 'Mon') return ['Mon']
  if (days === 'FO') return ['Fri']
  if (days === 'FO' || days === 'Fri') return ['Fri']
  if (days === 'Daily') return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun']
  throw Error('Unknown days ' + days)
}

let timetableCount = 0

async function loadTimetableCSV (filename) {
  let timetable = fs.readFileSync('full-gunzel-mode/timetables/' + filename).toString()
  timetable = await new Promise(resolve => parseCSV(timetable, {
    trim: true,
    skip_empty_lines: true
  }, (err, t) => resolve(t)))

  timetable = timetable.slice(1)
  timetable = timetable.filter((e, i) => {
    return !(e.join('').toLowerCase().includes('ex ') && i < 5)
  })
  if (timetable.map(r=>r.slice(0, 1)).join('') == '')
    timetable = timetable.map(row => row.slice(1))

  let leftColumns = timetable.map(row => row.slice(0, 2))
  const tripCount = timetable[0].length - 2
  let trips = []

  for (let i = 0; i < tripCount; i++) {
    const tripData = []
    for (let j = 0; j < leftColumns.length; j++) {
      let stopTiming = timetable[j][i + 2]
      if (stopTiming.toLowerCase().includes('to ')) continue
      tripData.push(stopTiming)
    }
    trips.push(tripData)
  }

  trips = trips.filter(e => e.join('').replace(/\./g, '') !== '')
  let mergedTrips = []
  let currentTrip = []
  for (let i = 0; i < trips.length; i++) {
    let trip = trips[i]
    let runID = trip[0]

    if (runID) { // brand new trip
      mergedTrips.push(currentTrip)
      currentTrip = trip
    } else { // need to merge
      for (let j = 1; j < trip.length; j++) {
        if (trip[j])
          currentTrip[j] = trip[j]
      }
    }
  }

  mergedTrips.push(currentTrip)

  let prevStation = ''
  let hasExtraRow = trips.map(trip => trip.slice(4, 6).join('')).join('').includes('*If req')
  let start = 4
  if (hasExtraRow) start = 5

  leftColumns = leftColumns.slice(start).map(parts => {
    if (parts.join('') === '') parts[1] = '---'
    if (parts[0]) prevStation = parts[0]
    else parts[0] = prevStation

    parts[0] = parts[0].toLowerCase()
    parts[0] = parts[0].replace(/ st\.?/, ' Street')
    parts[0] = parts[0].replace(' yd', ' Yard')
    parts[0] = parts[0].replace(' sdg', ' Siding')
    parts[0] = parts[0].replace(' rd', ' Road')
    parts[0] = parts[0].replace(/ jct\.?/, ' Junction')
    parts[0] = parts[0].replace(' sth', ' South')
    parts[0] = parts[0].replace(' nth', ' North')
    parts[0] = parts[0].replace(' BP', ' Block Point')
    parts[0] = parts[0].replace(/[\(\)]/g, '')

    let words = parts[0].split(' ')
    parts[0] = words.map(word => {
      if (word.length <= 2) return word.toUpperCase()
      return word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase()
    }).join(' ')

    parts[0] = parts[0].replace('Mtm', 'MTM')

    return parts
  }).filter(e => e.join('') !== '')
  const routeStops = leftColumns.map(e => e[0]).filter((e, i, a) => a.indexOf(e) === i)

  return { trips: mergedTrips.slice(1), routeStops, leftColumns }
}

function padMin4(input) {
  if (input.length >= 4) return input
  return [0, 0, 0, 0].concat([...input]).slice(-4).join('')
}

async function loadTrips (csvData) {
  const { trips, routeStops, leftColumns } = csvData
  let hasExtraRow = trips.map(trip => trip.slice(4, 6).join('')).join('').includes('*If req')

  return trips.map(trip => {
    let tripMeta = trip.slice(0, 5)
    let timings
    if (hasExtraRow)
      timings = trip.slice(5)
    else
      timings = trip.slice(4)

    let runID = padMin4(tripMeta[0]),
        operator = tripMeta[1],
        type = tripMeta[2]
    let days

    if (type === 'Conditional' && tripMeta[3] === '')
      days = operatingDaysToArray('Daily')
    else
      days = operatingDaysToArray(tripMeta[3])

    let mappedTimings = {}
    let broke = false
    let skip = false
    timings.forEach((timing, i) => {
      if (broke) return
      if (skip) return skip = false
      let stopName = leftColumns[i]

      if (timing == '..') timing = ''
      if (timing) {
        if (stopName[1] == '--') return
        if (timing.startsWith('via')) return
        if (timing.toLowerCase().includes('ex')) return
        if (timing.toLowerCase().includes('continue')) return broke = true
        if (timing.toLowerCase() === 'hold at') return skip = true
        if (timing.startsWith('@')) return

        if (timing.match(/^\d{1,3}$/))
          timing = padMin4(timing)
        else if (timing.match(/^\d{4}/))
          timing = timing.slice(0, 4)
        if (timing.match(/^[A-Za-z]+$/) || timing.match(/\d/g).length < 3) return
        let arrivalTime, departureTime
        if (timing.includes('/')) {
          let parts = timing.split('/')
          arrivalTime = padMin4(parts[0])

          let arrivalHour = arrivalTime.slice(0, 2)
          if (parts[1].length == 2)
            departureTime = arrivalHour + parts[1]
          else
            departureTime = parts[1]
        } else {
          arrivalTime = timing.slice(0, 4)
          departureTime = arrivalTime
        }
        let name = stopName[0],
            type = stopName[1]

        if (mappedTimings[name]) {
          mappedTimings[name].departureTime = departureTime
        } else {
          mappedTimings[name] = {
            stopName: name,
            arrivalTime, departureTime
          }
        }
      }
    })

    let tripData = {
      runID, operator, operationDays: days,
      stopTimings: Object.values(mappedTimings)
    }
    return tripData
  })
}

(async function() {
  let files = fs.readdirSync('full-gunzel-mode/timetables')

  let allTrips = {}

  let i = -1
  async function loadFile() {
    if (++i == files.length) return

    const csvData = await loadTimetableCSV(files[i])
    let trips = await loadTrips(csvData)
    trips.forEach(trip => {
      let id = trip.runID + '-' + trip.operationDays.join('-')
      if (allTrips[id]) {
        allTrips[id].stopTimings =
          allTrips[id].stopTimings.concat(trip.stopTimings)
      } else {
        allTrips[id] = trip
      }
    })

    await loadFile()
  }

  await loadFile()

  let mergedTrips = Object.values(allTrips).map(trip => {
    let stopsSeen = []
    trip.stopTimings = trip.stopTimings.filter(stop => {
      if (stopsSeen.includes(stop.stopName)) return false
      stopsSeen.push(stop.stopName)
      return true
    })

    let hasBefMidnight = trip.stopTimings.filter(stop => stop.departureTime > 2300)
    let hasAftMidnight = trip.stopTimings.filter(stop => stop.departureTime < 1000)
    let runsAcrossDays = hasBefMidnight && hasAftMidnight
    if (runsAcrossDays) {
      trip.stopTimings = trip.stopTimings.map(stop => {
        stop.departureTimeMinutes = stop.departureTime.slice(0, 2) * 60 + stop.departureTime.slice(2) * 1
        if (stop.departureTimeMinutes <= 540) // 9am, sufficient time?
          stop.departureTimeMinutes += 24 * 60
        return stop
      }).sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes).map(stop => {
        delete stop.departureTimeMinutes
        return stop
      })
    }

    return trip
  })

  // console.log(mergedTrips.filter(r=>r.runID === '9348')[0])
  console.log(JSON.stringify(Object.values(mergedTrips),null,2))
  console.log('Completed loading in ' + timetableCount + ' VNET timetables')
  process.exit()
})()
