const async = require('async')
const utils = require('../../utils')
const moment = require('moment')
const getCoachDepartures = require('../regional-coach/get-departures')

const terminiToLines = require('../../load-gtfs/vline-trains/termini-to-lines')

module.exports = async function(station, db) {
  if (!station.stopName.endsWith('Railway Station')) throw Error('Use regional_trains module instead')
  let coachStop = station.bays.filter(bay => bay.mode === 'regional coach')[0]
  let vlinePlatform = station.bays.filter(bay => bay.mode === 'regional train')[0]

  if (station.stopName === 'Southern Cross Railway Station') {
    // lookup scs coach terminal
    station = await db.getCollection('stops').findDocument({
      stopName: "Southern Cross Coach Terminal/Spencer St"
    })
    coachStop = station.bays.filter(bay => bay.mode === 'regional coach')[0]
  }

  if (!coachStop && !!vlinePlatform) coachStop = vlinePlatform
  if (!coachStop) return []

  const gtfsTimetables = db.getCollection('gtfs timetables')
  const timetables = db.getCollection('timetables') // bold assumption that coach replacements don't occur with special services
  const minutesPastMidnight = utils.getMinutesPastMidnightNow()

  let coachDepartures = (await getCoachDepartures(station, db))

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
    return departure.departureTime + departure.destination
  })

  let mappedCoachDepartures = coachDepartures.filter(departure => {
    let {trip} = departure
    let {destination} = departure
    if (departure.destination === 'Southern Cross Coach Terminal/Spencer St')
      destination = 'Southern Cross Railway Station'

    let index = departure.departureTime + destination
    return timetabledDeparturesIndex.includes(index) || departure.isOverride
  }).map(departure => {
    let {trip} = departure
    let stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === coachStop.stopGTFSID)[0]

    let scheduledDepartureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, utils.now())

    let {origin, destination} = trip

    let originDest = `${origin}-${destination}`
    let routeName = terminiToLines[originDest] || terminiToLines[origin] || terminiToLines[destination]
    trip.shortRouteName = routeName

    return {
      trip, estimatedDepartureTime: null, platform: null,
      stopData, scheduledDepartureTime,
      departureTimeMinutes: stopData.departureTimeMinutes, isCoachService: true,
      actualDepartureTime: scheduledDepartureTime,
      coachCount: departure.coachCount
    }
  })

  return mappedCoachDepartures
}
