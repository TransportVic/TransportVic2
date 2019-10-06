const async = require('async')
const utils = require('../../utils')
const moment = require('moment')

module.exports = async function(station, db) {
  if (!station.stopName.endsWith('Railway Station')) throw Error('Use regional_trains module instead')
  let coachStop = station.bays.filter(bay => bay.mode === 'regional coach')[0]
  let vlinePlatform = station.bays.filter(bay => bay.mode === 'regional train')[0]

  if (!coachStop && station.stopName === 'Southern Cross Railway Station') {
    // lookup scs coach terminal
    coachStop = (await db.getCollection('stops').findDocument({
      stopName: "Southern Cross Coach Terminal"
    })).bays.filter(bay => bay.mode === 'regional coach')[0]
  }

  const gtfsTimetables = db.getCollection('gtfs timetables')
  const timetables = db.getCollection('timetables') // bold assumption that coach replacements don't occur with special services
  const minutesPastMidnight = utils.getMinutesPastMidnightNow()

  let gtfsDepartures = await gtfsTimetables.findDocuments({
    operationDays: utils.getYYYYMMDDNow(),
    mode: "regional coach",
    stopTimings: {
      $elemMatch: {
        stopGTFSID: coachStop.stopGTFSID,
        departureTimeMinutes: {
          $gte: minutesPastMidnight - 1,
          $lte: minutesPastMidnight + 180
        }
      }
    }
  }).toArray()
  let timetabledDepartures = await timetables.findDocuments({
    operationDays: utils.getPTDayName(utils.now()),
    mode: "regional train",
    stopTimings: {
      $elemMatch: {
        stopGTFSID: vlinePlatform.stopGTFSID,
        departureTimeMinutes: {
          $gte: minutesPastMidnight - 1,
          $lte: minutesPastMidnight + 180
        }
      }
    }
  }).toArray()
  let timetabledDeparturesIndex = timetabledDepartures.map(departure => {
    return departure.departureTime + ' ' + departure.destination
  })

  return gtfsDepartures.filter(departure => {
    let index = departure.departureTime + ' ' + departure.destination
    return timetabledDeparturesIndex.includes(index)
  }).map(trip => {
    const stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === coachStop.stopGTFSID)[0]

    return {
      trip, estimatedDepartureTime: null, platform: null,
      stopData, scheduledDepartureTime: utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now()),
      departureTimeMinutes: stopData.departureTimeMinutes, isCoachService: true
    }
  })
}
