const async = require('async')
const utils = require('../../utils')
const moment = require('moment')

module.exports = async function getScheduledDepartures(station, db) {
    const gtfsTimetables = db.getCollection('gtfs timetables')
    const minutesPastMidnight = utils.getMinutesPastMidnightNow()

    const metroPlatform = station.bays.filter(bay => bay.mode === 'metro train')[0]

    let departures = await gtfsTimetables.findDocuments({
      operationDays: utils.getYYYYMMDDNow(),
      mode: "metro train",
      stopTimings: {
        $elemMatch: {
          stopGTFSID: metroPlatform.stopGTFSID,
          departureTimeMinutes: {
            $gte: minutesPastMidnight - 1,
            $lte: minutesPastMidnight + 90
          }
        }
      }
    }).toArray()

    return departures.map(departure => {
      let stopData = departure.stopTimings.filter(stop => stop.stopGTFSID === metroPlatform.stopGTFSID)[0]
      let departureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now())

      return {
        trip: departure,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: departureTime,
        platform: '?',
        scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
        cancelled: false,
        cityLoopConfig: [],
        destination: departure.destination.slice(0, -16),
        runID: ''
      }
    }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}
