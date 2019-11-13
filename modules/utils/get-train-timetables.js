const async = require('async')
const utils = require('../../utils')

function getPlatform(station, mode) {
  return station.bays.filter(bay => bay.mode === mode)[0]
}

async function getLiveDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes) {
  const platform = getPlatform(station, mode)

  let timetables = await db.getCollection('live timetables').findDocuments({
    routeName: {
      $in: possibleLines
    },
    operationDays: utils.getYYYYMMDDNow(),
    mode: mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: platform.stopGTFSID,
        departureTimeMinutes: scheduledDepartureTimeMinutes
      }
    }
  }).toArray()

  let trip = timetables[0]

  if (timetables.length && timetables[0].type === 'suspension') {
    if (timetables.length > 1)
      trip = timetables.sort((a, b) => b.stopTimings[0].departureTimeMinutes - a.stopTimings[0].departureTimeMinutes).slice(0, 1)
  }

  if (trip) {
    trip.destination = trip.destination.slice(0, -16)
    trip.origin = trip.origin.slice(0, -16)
  }
  return trip
}

async function getScheduledDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations) {
  const platform = getPlatform(station, mode)
  let departureHour = Math.floor(scheduledDepartureTimeMinutes / 60)

  let timetables = await db.getCollection('gtfs timetables').findDocuments({
    routeName: {
      $in: possibleLines
    },
    destination: {
      $in: possibleDestinations
    },
    operationDays: utils.getYYYYMMDDNow(),
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: platform.stopGTFSID,
        departureTimeMinutes: scheduledDepartureTimeMinutes % 1440
      }
    }
  }, {tripStartHour: 0, tripEndHour: 0}).limit(2).toArray()

  let trip = timetables.sort((a, b) => b.stopTimings[0].departureTimeMinutes - a.stopTimings[0].departureTimeMinutes)[0]

  if (trip) {
    trip.destination = trip.destination.slice(0, -16)
    trip.origin = trip.origin.slice(0, -16)
  }
  return trip
}

async function getStaticDeparture(runID, db) {
  let trip = await db.getCollection('timetables').findDocument({
    runID,
    operationDays: utils.getPTDayName(utils.now())
  })

  if (trip) {
    trip.destination = trip.destination.slice(0, -16)
    trip.origin = trip.origin.slice(0, -16)
  }

  return trip
}

async function getScheduledDepartures(station, db, mode, timeout) {
    const gtfsTimetables = db.getCollection('gtfs timetables')
    const liveTimetables = db.getCollection('live timetables')
    const minutesPastMidnight = utils.getMinutesPastMidnightNow()

    const platform = getPlatform(station, mode)

    let query = {
      operationDays: utils.getYYYYMMDDNow(),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: platform.stopGTFSID,
          departureTimeMinutes: {
            $gte: minutesPastMidnight - 1,
            $lte: minutesPastMidnight + timeout
          }
        }
      }
    }

    let gtfsDepartures = await gtfsTimetables.findDocuments(query).toArray()
    let liveDepartures = await liveTimetables.findDocuments(query).toArray()

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
      let departureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now())

      trip.destination = trip.destination.slice(0, -16)
      trip.origin = trip.origin.slice(0, -16)

      return {
        trip,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: departureTime,
        platform: '?',
        scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
        cancelled: false,
        cityLoopConfig: [],
        destination: trip.destination,
        runID: '',
        cancelled: trip.type === 'cancelled'
      }
    }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  getLiveDeparture,
  getScheduledDeparture,
  getStaticDeparture,
  getScheduledDepartures
}
