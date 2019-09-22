const async = require('async')
const moment = require('moment')
const utils = require('../../utils')
require('moment-timezone')

async function getScheduledDepartures(station, db) {
  const gtfsTimetables = db.getCollection('gtfs timetables')

  const minutesPastMidnight = utils.getMinutesPastMidnightNow()

  const metroPlatform = station.bays.filter(bay => bay.mode === 'metro train')[0]

  const trips = await gtfsTimetables.findDocuments({
   stopTimings: {
     $elemMatch: {
       stopGTFSID: metroPlatform.stopGTFSID,
       departureTimeMinutes: {
         $gt: minutesPastMidnight,
         $lte: minutesPastMidnight + 180
       }
     }
   },
   operationDays: utils.getYYYYMMDDNow(),
   mode: "metro train"
 }).toArray()

 return trips.map(trip => {
   const stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === metroPlatform.stopGTFSID)[0]
   return {trip, stopData}
 })
}

module.exports = getScheduledDepartures
