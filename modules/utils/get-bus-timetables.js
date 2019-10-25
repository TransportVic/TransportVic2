const async = require('async')
const utils = require('../../utils')

/*

  if offline: needs all GTFS IDs for each bay that matches
  if online: merge by raw ptv stop name, get first

*/
function getUniqueGTFSIDs(station, mode, isOnline) {
  let gtfsIDs = []
  let bays = station.bays.filter(bay => bay.mode === mode)

  if (isOnline) {
    let stopNamesSeen = []
    bays.forEach(bay => {
      if (!stopNamesSeen.includes(bay.originalName)) {
        stopNamesSeen.push(bay.originalName)
        gtfsIDs.push(bay.stopGTFSID)
      }
    })
  } else {
    gtfsIDs = bays.map(bay => bay.stopGTFSID)
  }

  return gtfsIDs
}

async function getDeparture(db, stopGTFSID, scheduledDepartureTimeMinutes, destination, mode, day) {
  let departureHour = Math.floor(scheduledDepartureTimeMinutes / 60)
  if (departureHour < 3) departureHour += 24 // 3am PT day :(

  let query = {
    operationDays: day || utils.getYYYYMMDDNow(),
    mode,
    stopTimings: {
      $elemMatch: {
        stopGTFSID: {
          $in: stopGTFSID
        },
        departureTimeMinutes: scheduledDepartureTimeMinutes
      }
    },
    destination: utils.adjustStopname(destination),
    tripStartHour: {
      $lte: departureHour
    },
    tripEndHour: {
      $gte: departureHour
    }
  }

  return await db.getCollection('live timetables').findDocument(query) || await db.getCollection('gtfs timetables').findDocument(query)
}

async function getScheduledDepartures(stopGTFSID, db, mode, timeout, useLive) {
    const timetables = db.getCollection((useLive ? 'live' : 'gtfs') + ' timetables')
    const minutesPastMidnight = utils.getMinutesPastMidnightNow()

    let departures = await timetables.findDocuments({
      $or: [{
        operationDays: utils.getYYYYMMDDNow()
      }, {
        operationDay: utils.getYYYYMMDDNow()
      }],
      mode,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: stopGTFSID,
          departureTimeMinutes: {
            $gte: minutesPastMidnight - 1,
            $lte: minutesPastMidnight + timeout
          }
        }
      }
    }).toArray()

    return departures.map(departure => {
      let stopData = departure.stopTimings.filter(stop => stop.stopGTFSID === stopGTFSID)[0]
      let departureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now())

      return {
        trip: departure,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: departureTime,
        scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
        destination: departure.destination
      }
    }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

module.exports = {
  getUniqueGTFSIDs,
  getScheduledDepartures,
  getDeparture
}
