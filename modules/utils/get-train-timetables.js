const async = require('async')
const utils = require('../../utils')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

function getPlatform(station, mode) {
  return station.bays.filter(bay => bay.mode === mode)[0]
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

  let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime)

  for (let i = 0; i <= 1; i++) {
    let day = departureTime.clone().add(-i, 'days')
    let timetables = await collection.findDocuments({
      _id: {
        $not: {
          $in: seen
        }
      },
      routeName: {
        $in: possibleLines
      },
      destination: {
        $in: possibleDestinations
      },
      operationDays: day.format('YYYYMMDD'),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: platform.stopGTFSID,
          departureTimeMinutes: (scheduledDepartureTimeMinutes % 1440) + 1440 * i
        }
      },
      direction
    }).toArray()

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
    operationDays: utils.getPTDayName(utils.now())
  })

  return trip
}

async function getScheduledDepartures(station, db, mode, timeout) {
  const gtfsTimetables = db.getCollection('gtfs timetables')
  const liveTimetables = db.getCollection('live timetables')
  const minutesPastMidnight = utils.getMinutesPastMidnightNow()

  const platform = getPlatform(station, mode)

  let gtfsDepartures = []
  let liveDepartures = []
  let today = utils.now().startOf('day')

  let days = {}

  for (let i = 0; i <= 1; i++) {
    let day = today.clone().add(-i, 'days')

    let departureTimeMinutes = (minutesPastMidnight % 1440) + 1440 * i

    let query = {
      operationDays: day.format('YYYYMMDD'),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: platform.stopGTFSID,
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

  function getID(departure) { return departure.departureTime + departure.origin + departure.destination }

  let serviceIndex = []
  let departures = []

  liveDepartures.concat(gtfsDepartures).forEach(departure => {
    let id = getID(departure)
    if (!serviceIndex.includes(id)) {
      serviceIndex.push(id)
      departures.push(departure)
    }
  })

  return departures.map(trip => {
    let stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === platform.stopGTFSID)[0]
    let departureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, days[trip.tripID])

    return {
      trip,
      scheduledDepartureTime: departureTime,
      estimatedDepartureTime: null,
      actualDepartureTime: departureTime,
      platform: '?',
      scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
      cancelled: false,
      cityLoopConfig: [],
      destination: trip.destination.slice(0, -16),
      runID: '',
      cancelled: trip.type === 'cancelled',
      suspensions: [],
      consist: []
    }
  }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
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


async function getScheduledMetroDepartures(station, db) {
  let departures = await getScheduledDepartures(station, db, 'metro train', 120)
  let stopName = station.stopName.slice(0, -16)
  let stopCode = stopCodes[stopName]
  let isInCity = cityLoopStations.includes(stopName) || stopName === 'Flinders Street'

  return (await async.map(departures, async departure => {
    let cityLoopConfig = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))
    .filter(stop => filterStops.includes(stop)).map(stop => stopCodes[stop])
    let willGoByCityLoop = cityLoopConfig.includes('MCE')

    if (isInCity && departure.trip.destination === 'Parliament Railway Station') return null

    if (departure.trip.direction === 'Up') {
      departure.destination = departure.trip.trueDestination.slice(0, -16)

      if (departure.destination === 'Flinders Street') {
        let viaCityLoop = cityLoopConfig[0] === 'FGS' || cityLoopConfig[0] === 'PAR'

        if (viaCityLoop) {
          departure.destination = 'City Loop'
        }

        if (willGoByCityLoop) {
          cityLoopConfig.shift()
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
