const moment = require('moment')
const utils = require('../../utils')

module.exports = async function (suspensions, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
  suspensions.forEach(async suspension => {

    let stationsAffected = suspension.description.match(/between ([ \w]+) and ([ \w]+) stations/)
    let startStation = stationsAffected[1].trim() + ' Railway Station',
        endStation = stationsAffected[2].trim() + ' Railway Station'
    let fromTime = moment.tz(suspension.from_date, 'Australia/Melbourne')
    let toTime = suspension.to_date ? moment.tz(suspension.to_date, 'Australia/Melbourne') : fromTime.clone().endOf('day')

    let tripsAffected = await gtfsTimetables.findDocuments({
      $and: [{
        $or: [{
          stopTimings: { // origin
            $elemMatch: {
              stopName: startStation,
              departureTimeMinutes: {
                $gte: utils.getPTMinutesPastMidnight(fromTime)
              }
            }
          }
        }, {
          stopTimings: { // dest
            $elemMatch: {
              stopName: startStation,
              arrivalTimeMinutes: {
                $lte: utils.getPTMinutesPastMidnight(toTime)
              }
            }
          }
        }]
      }, {
        $or: [{
          stopTimings: { // origin
            $elemMatch: {
              stopName: endStation,
              departureTimeMinutes: {
                $gte: utils.getPTMinutesPastMidnight(fromTime)
              }
            }
          }
        }, {
          stopTimings: { // dest
            $elemMatch: {
              stopName: endStation,
              arrivalTimeMinutes: {
                $lte: utils.getPTMinutesPastMidnight(toTime)
              }
            }
          }
        }]
      }],
      operationDays: utils.getYYYYMMDDNow(),
      mode: "metro train"
    }).toArray()

    let splitTrips = []
    tripsAffected.forEach(trip => {
      let tripStops = trip.stopTimings.map(stop => stop.stopName)
      let firstSuspendedStopIndex = tripStops.indexOf(startStation)
      let lastSuspendedStopIndex = tripStops.indexOf(endStation)

      if (lastSuspendedStopIndex == -1 && firstSuspendedStopIndex == -1) return

      if (firstSuspendedStopIndex > lastSuspendedStopIndex && lastSuspendedStopIndex !== -1) {
        firstSuspendedStopIndex = tripStops.indexOf(endStation)
        lastSuspendedStopIndex = tripStops.indexOf(startStation)
      }
      let firstHalfStops = [], busReplacement = [], secondHalfStops = []
      if (firstSuspendedStopIndex == -1) { // starts/ends after the first suspended stop
        if (trip.direction == 'Up') {
          busReplacement = trip.stopTimings.slice(lastSuspendedStopIndex)
          secondHalfStops = trip.stopTimings.slice(0, lastSuspendedStopIndex + 1)
        } else {
          busReplacement = trip.stopTimings.slice(0, lastSuspendedStopIndex + 1)
          secondHalfStops = trip.stopTimings.slice(lastSuspendedStopIndex)
        }
      } else if (lastSuspendedStopIndex == -1) { // starts/ends before the last suspended stop
        if (trip.direction == 'Up') {
          firstHalfStops = trip.stopTimings.slice(firstSuspendedStopIndex)
          busReplacement = trip.stopTimings.slice(0, firstSuspendedStopIndex + 1)
        } else {
          firstHalfStops = trip.stopTimings.slice(0, firstSuspendedStopIndex + 1)
          busReplacement = trip.stopTimings.slice(firstSuspendedStopIndex)
        }
      } else {
        firstHalfStops = trip.stopTimings.slice(0, firstSuspendedStopIndex + 1)
        busReplacement = trip.stopTimings.slice(firstSuspendedStopIndex, lastSuspendedStopIndex + 1)
        secondHalfStops = trip.stopTimings.slice(lastSuspendedStopIndex)
      }

      if (firstHalfStops.length) {
        let firstTrip = {
          mode: "metro train",
          operator: "Metro Trains Melbourne",
          routeName: trip.routeName,
          runID: null,
          operationDay: utils.getYYYYMMDDNow(),
          vehicle: "Metro Train",
          stopTimings: firstHalfStops,
          destination: firstHalfStops.slice(-1)[0].stopName,
          departureTime: trip.departureTime,
          origin: firstHalfStops[0].stopName,
          type: "suspension",
          direction: trip.direction,
          tripID: trip.tripID + '-A'
        }
        splitTrips.push(firstTrip)
      }
      if (busReplacement.length) {
        let busTrip = {
          mode: "metro train",
          operator: null,
          routeName: trip.routeName,
          runID: null,
          operationDay: utils.getYYYYMMDDNow(),
          vehicle: "Replacement Bus",
          stopTimings: busReplacement,
          destination: busReplacement.slice(-1)[0].stopName,
          departureTime: busReplacement[0].departureTime,
          origin: busReplacement[0].stopName,
          type: "suspension",
          direction: trip.direction,
          tripID: trip.tripID + '-B'
        }
        splitTrips.push(busTrip)
      }
      if (secondHalfStops.length) {
        let secondTrip = {
          mode: "metro train",
          operator: "Metro Trains Melbourne",
          routeName: trip.routeName,
          runID: null,
          operationDay: utils.getYYYYMMDDNow(),
          vehicle: "Metro Train",
          stopTimings: secondHalfStops,
          destination: secondHalfStops.slice(-1)[0].stopName,
          departureTime: secondHalfStops[0].departureTime,
          origin: secondHalfStops[0].stopName,
          type: "suspension",
          direction: trip.direction,
          tripID: trip.tripID + '-C'
        }
        splitTrips.push(secondTrip)
      }
    })

    await liveTimetables.deleteDocuments({
      routeName: {
        $in: suspension.routes.map(route => route.route_name)
      },
      type: "suspension"
    })
    await liveTimetables.bulkWrite(splitTrips.map(trip => {
      let key = {
        mode: "metro train",
        routeName: trip.routeName,
        origin: trip.origin,
        destination: trip.destination,
        departureTime: trip.departureTime,
        type: "suspension",
        operationDay: trip.operationDay
      }

      return {
        replaceOne: {
          filter: key,
          replacement: trip,
          upsert: true
        }
      }
    }))
  })
}
