const async = require('async')
const utils = require('../../utils')

function getPlatform(station, mode) {
  return station.bays.filter(bay => bay.mode === mode)[0]
}

async function getDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations, live) {
  const platform = getPlatform(station, mode)

  let collection = db.getCollection(live ? 'live timetables' : 'gtfs timetables')

  let seen = []
  let allTimetables = []
  let today = utils.now()

  for (let i = 0; i <= 1; i++) {
    let day = today.clone().add(-i, 'days')
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
      }
    }).limit(2).toArray()

    timetables = timetables.map(timetable => {
      let startTime = day.startOf('day').add(timetable.stopTimings[0].departureTimeMinutes, 'minutes')
      timetable.sortID = +startTime
      return timetable
    })

    seen = seen.concat(timetables.map(e => e._id))
    allTimetables.push(timetables)
  }

  let timetables = allTimetables.reduce((a, e) => a.concat(e), [])

  return timetables[0]
}

function getScheduledDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations) {
  return getDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations, false)
}

function getLiveDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations) {
  return getDeparture(station, db, mode, possibleLines, scheduledDepartureTimeMinutes, possibleDestinations, true)
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

    let query = {
      operationDays: utils.getYYYYMMDDNow(),
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: platform.stopGTFSID,
          departureTimeMinutes: {
            $gte: minutesPastMidnight - 5,
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
