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
    operationDay: utils.getYYYYMMDDNow(),
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

  return trip
}

async function getScheduledDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations) {
  const platform = getPlatform(station, mode)
  const departureHour = Math.floor(scheduledDepartureTimeMinutes / 60)

  let timetables = await db.getCollection('gtfs timetables').findDocuments({
    routeName: {
      $in: possibleLines
    },
    destination: {
      $in: possibleDestinations
    },
    operationDays: utils.getYYYYMMDDNow(),
    mode: mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: platform.stopGTFSID,
        departureTimeMinutes: scheduledDepartureTimeMinutes
      }
    },
    tripStartHour: {
      $lte: departureHour
    },
    tripEndHour: {
      $gte: departureHour
    }
  }, {tripStartHour: 0, tripEndHour: 0}).limit(2).toArray()

  let trip = timetables.sort((a, b) => utils.time24ToMinAftMidnight(b.departureTime) - utils.time24ToMinAftMidnight(a.departureTime))[0]

  return trip
}

async function getStaticDeparture(runID, db) {
  return await db.getCollection('timetables').findDocument({
    runID,
    operationDays: utils.getPTDayName(utils.now())
  })
}

async function getScheduledDepartures(station, db, mode, timeout) {
    const gtfsTimetables = db.getCollection('gtfs timetables')
    const minutesPastMidnight = utils.getMinutesPastMidnightNow()

    const platform = getPlatform(station, mode)

    let departures = await gtfsTimetables.findDocuments({
      operationDays: utils.getYYYYMMDDNow(),
      mode: mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: platform.stopGTFSID,
          departureTimeMinutes: {
            $gte: minutesPastMidnight - 1,
            $lte: minutesPastMidnight + timeout
          }
        }
      }
    }).toArray()

    return departures.map(departure => {
      let stopData = departure.stopTimings.filter(stop => stop.stopGTFSID === platform.stopGTFSID)[0]
      let departureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now())

      departure.destination = departure.destination.slice(0, -16)

      return {
        trip: departure,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: departureTime,
        platform: '?',
        scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
        cancelled: false,
        cityLoopConfig: [],
        destination: departure.destination,
        runID: '',
      }
    }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  getLiveDeparture,
  getScheduledDeparture,
  getStaticDeparture,
  getScheduledDepartures
}
