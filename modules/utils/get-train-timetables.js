const async = require('async')
const utils = require('../../utils.mjs')
const { getDayOfWeek } = require('../../public-holidays.mjs')

const routeGTFSIDs = require('../../additional-data/metro-route-gtfs-ids')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

function getPlatform(station, mode) {
  return station.bays.find(bay => bay.mode === mode)
}

function trimFromFSS(stops) {
  let fssIndex = stops.map(stop => stop.stopName).indexOf('Flinders Street Railway Station')
  return stops.slice(fssIndex)
}

async function getDeparture(station, db, mode, possibleLines, departureTime, possibleDestinations, direction, live, viaCityLoop) {
  const platform = getPlatform(station, mode)

  let collection = db.getCollection(live ? 'live timetables' : 'gtfs timetables')

  let seen = []
  let allTimetables = []

  let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)

  let iterations = 0
  // Only check past day if within 1.5hr of midnight
  if (Math.abs(1440 - scheduledDepartureTimeMinutes) < 90 || scheduledDepartureTimeMinutes < 90) iterations = 1

  for (let i = 0; i <= iterations; i++) {
    let day = departureTime.clone().add(-i, 'days')
    let possibleRouteGTFSIDs = possibleLines.map(line => routeGTFSIDs[line])

    let query = collection.findDocuments({
      _id: {
        $not: {
          $in: seen
        }
      },
      routeGTFSID: {
        $in: possibleRouteGTFSIDs
      },
      destination: {
        $in: possibleDestinations
      },
      operationDays: utils.getYYYYMMDD(day),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: platform.stopGTFSID,
          departureTimeMinutes: scheduledDepartureTimeMinutes + 1440 * i
        }
      },
      direction
    })

    if (!live) query.hint('stop timings gtfs index')
    let timetables = await query.toArray()

    if (mode === 'metro train' && viaCityLoop !== undefined) {
      if (viaCityLoop) {
        timetables = timetables.filter(t => trimFromFSS(t.stopTimings).find(s => s.stopName === 'Flagstaff Railway Station'))
      } else {
        timetables = timetables.filter(t => !trimFromFSS(t.stopTimings).find(s => s.stopName === 'Flagstaff Railway Station'))
      }
    }

    timetables = timetables.map(timetable => {
      let startTime = day.startOf('day').add(timetable.stopTimings[0].departureTimeMinutes, 'minutes')
      timetable.sortID = +startTime
      return timetable
    })

    seen = seen.concat(timetables.map(e => e._id))
    allTimetables.push(timetables)
  }

  let timetables = allTimetables.reduce((a, e) => a.concat(e), [])

  return timetables.sort((a, b) => b.sortID - a.sortID)[0]
}

function getScheduledDeparture(station, db, mode, possibleLines, departureTime, possibleDestinations, direction, viaCityLoop) {
  return getDeparture(station, db, mode, possibleLines, departureTime, possibleDestinations, direction, false, viaCityLoop)
}

function getLiveDeparture(station, db, mode, possibleLines, departureTime, possibleDestinations, direction, viaCityLoop) {
  return getDeparture(station, db, mode, possibleLines, departureTime, possibleDestinations, direction, true, viaCityLoop)
}

async function getStaticDeparture(runID, db) {
  let trip = await db.getCollection('timetables').findDocument({
    runID,
    operationDays: await getDayOfWeek(utils.now())
  })

  return trip
}

async function getScheduledDepartures(station, db, mode, timeout) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
  let minutesPastMidnight = utils.getMinutesPastMidnightNow()

  let stopGTFSIDs = station.bays.filter(bay => bay.mode === mode).map(bay => bay.stopGTFSID)

  let gtfsDepartures = []
  let liveDepartures = []
  let today = utils.now().startOf('day')

  let days = {}

  for (let i = 0; i <= 1; i++) {
    let day = today.clone().add(-i, 'days')

    let departureTimeMinutes = (minutesPastMidnight % 1440) + 1440 * i

    let query = {
      operationDays: utils.getYYYYMMDD(day),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: {
            $in: stopGTFSIDs
          },
          departureTimeMinutes: {
            $gte: departureTimeMinutes - 5,
            $lte: departureTimeMinutes + timeout
          }
        }
      }
    }

    let gtfsTimetablesFound = await gtfsTimetables.findDocuments(query).toArray()
    let liveTimetablesFound = await liveTimetables.findDocuments(query).toArray()

    gtfsTimetablesFound.concat(liveTimetablesFound).forEach(t => {
      days[t.tripID] = day
    })

    gtfsDepartures = gtfsDepartures.concat(gtfsTimetablesFound)
    liveDepartures = liveDepartures.concat(liveTimetablesFound)
  }

  function getID(trip) {
    let stop = trip.stopTimings.find(s => stopGTFSIDs.includes(s.stopGTFSID))
    let id = `${stop.departureTimeMinutes}-${trip.stopTimings[0].stopGTFSID}-${trip.stopTimings[trip.stopTimings.length - 1].stopGTFSID}-${trip.routeGTFSID}`

    return id
  }

  let serviceIndex = []
  let departures = []

  liveDepartures.concat(gtfsDepartures).forEach(trip => {
    let id = getID(trip)
    if (!serviceIndex.includes(id)) {
      serviceIndex.push(id)
      departures.push(trip)
    }
  })

  let timeMS = +utils.now()
  let timeoutMS = timeout * 60 * 1000

  let lateDepartures = await liveTimetables.findDocuments({
    _id: {
      $not: {
        $in: liveDepartures.map(trip => trip._id)
      }
    },
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSIDs
        },
        actualDepartureTimeMS: {
          $gte: timeMS - 1000 * 60,
          $lte: timeMS + timeoutMS
        }
      }
    },
    destination: {
      $ne: station.stopName
    }
  }).toArray()

  lateDepartures.forEach(departure => {
    days[departure.tripID] = utils.parseDate(departure.operationDays)
  })

  return departures.concat(lateDepartures).map(trip => {
    let stopData = trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
    let departureTime = utils.getMomentFromMinutesPastMidnight(stopData.departureTimeMinutes, days[trip.tripID])

    let estimatedDepartureTime = stopData.estimatedDepartureTime || null
    if (estimatedDepartureTime) {
      estimatedDepartureTime = utils.parseTime(estimatedDepartureTime)
      if (estimatedDepartureTime < timeMS - 1000 * 60) return null
    }

    return {
      trip,
      scheduledDepartureTime: departureTime,
      estimatedDepartureTime,
      actualDepartureTime: estimatedDepartureTime || departureTime,
      platform: stopData.platform || '??',
      scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
      cityLoopConfig: [],
      destination: trip.destination.slice(0, -16),
      runID: '',
      cancelled: trip.type === 'cancellation' || trip.cancelled,
      suspensions: [],
      consist: [],
      isRailReplacementBus: trip.isRailReplacementBus || false
    }
  }).filter(Boolean).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

let filterStops = [...cityLoopStations, 'Flinders Street', 'Richmond', 'North Melbourne', 'Jolimont']
let stopCodes = {
  'Flinders Street': 'FSS',
  'Southern Cross': 'SSS',
  'Flagstaff': 'FGS',
  'Melbourne Central': 'MCE',
  'Parliament': 'PAR',
  'Richmond': 'RMD',
  'Jolimont': 'JLI',
  'North Melbourne': 'NME'
}

let lineGroups = {
  'Cranbourne': 'CFD',
  'Pakenham': 'CFD',
  'Sandringham': 'CFD',

  'Glen Waverley': 'BLY',
  'Lilydale': 'BLY',
  'Belgrave': 'BLY',
  'Alamein': 'BLY',

  'Hurstbridge': 'CHL',
  'Mernda': 'CHL',

  'Frankston': 'CCY',
  'Williamstown': 'CCY',
  'Werribee': 'CCY',

  'Upfield': 'NOR',
  'Sunbury': 'NOR',
  'Craigieburn': 'NOR',
  'Flemington Racecourse': 'NOR',
}

async function getScheduledMetroDepartures(station, db) {
  let departures = await getScheduledDepartures(station, db, 'metro train', 120)
  departures = departures.filter(d => !d.h)
  let stopName = station.stopName.slice(0, -16)
  let stopCode = stopCodes[stopName]
  let isInCity = cityLoopStations.includes(stopName) || stopName === 'Flinders Street'

  if (isInCity) {
    let downTrains = departures.filter(departure => departure.trip.direction === 'Down')
    let downTrainIDs = downTrains.map(departure => {
      return `${departure.scheduledDepartureTime.format('HH:mm')}${lineGroups[departure.trip.routeName]}`
    })
    let upTrains = departures.filter(departure => departure.trip.direction === 'Up')
    let uniqueUp = upTrains.filter(departure => {
      let id = `${departure.scheduledDepartureTime.format('HH:mm')}${lineGroups[departure.trip.routeName]}`
      return !downTrainIDs.includes(id)
    })

    departures = downTrains.concat(uniqueUp).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  }

  return (await async.map(departures, async departure => {
    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    let cityLoopConfig = tripStops.filter(stop => filterStops.includes(stop)).map(stop => stopCodes[stop])
    let willGoByCityLoop = cityLoopConfig.includes('MCE')

    if (isInCity && departure.trip.destination === 'Parliament Railway Station') return null

    if (departure.trip.direction === 'Up') {
      departure.destination = departure.trip.trueDestination.slice(0, -16)

      if (departure.destination === 'Flinders Street') {
        if (willGoByCityLoop) cityLoopConfig.shift()
        let viaCityLoop = cityLoopConfig[0] === 'FGS' || cityLoopConfig[0] === 'PAR'

        if (viaCityLoop && !isInCity) {
          departure.destination = 'City Loop'
        }

        departure.cityLoopConfig = cityLoopConfig
      }
    } else if (isInCity) {
      let upcoming = cityLoopConfig.slice(stopCode)
      let viaCityLoop = upcoming.includes('FGS')

      if (viaCityLoop) {
        cityLoopConfig.pop()
      } else {
        if (upcoming.includes('SSS')) cityLoopConfig = ['FSS', 'SSS', 'NME']
        else cityLoopConfig = cityLoopConfig.slice(-2)
      }

      departure.cityLoopConfig = cityLoopConfig
    }

    let altLoopConfig = []
    if (departure.trip.routeName === 'Werribee') {
      let stopsNPTLAV = tripStops.includes('Newport') && tripStops.includes('Laverton')
      if (stopsNPTLAV) {
        if (tripStops.includes('Altona')) { // Via ALT Loop
          altLoopConfig = ['WTO', 'ALT', 'SHE']
        } else { // Via ML
          altLoopConfig = ['LAV', 'NPT']
        }

        if (departure.trip.direction === 'Down') altLoopConfig.reverse()
      }
    }

    departure.altLoopConfig = altLoopConfig

    if (departure.trip.routeGTFSID === '2-CCL')
      departure.destination = 'City Circle'

    return departure
  })).filter(Boolean)
}

module.exports = {
  getLiveDeparture,
  getScheduledDeparture,
  getStaticDeparture,
  getScheduledDepartures,
  getScheduledMetroDepartures
}
