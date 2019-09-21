const TimedCache = require('timed-cache')
const async = require('async')
const moment = require('moment')
require('moment-timezone')
const ptvAPI = require('../../ptv-api')

const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })
const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

let cityLoopStations = ['southern cross', 'parliament', 'flagstaff', 'melbourne central'];

let burnleyGroup = [1, 2, 7, 9]; // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12]; // cranbourne, frankston, pakenham, sandringham
let northenGroup = [3, 14, 15, 16, 17]; // craigieburn, sunbury, upfield, werribee, williamstown
let cliftonHillGroup = [5, 8]; // mernda, hurstbridge

function getMinutesPastMidnight(time) {
  const startOfToday = time.clone().startOf('day')
  return time.diff(startOfToday, 'minutes')
}

function getDayName(time) {
  let minutesPastMidnight = getMinutesPastMidnight(time);
  let offset = 0;

  if (minutesPastMidnight < 180) offset = -1440;
  return daysOfWeek[time.clone().add(offset, 'minutes').day()]
}

async function findTripFromStop(timetables, stopGTFSID, departureTimeMinutes, scheduledDepartureTime, lineName, direction, runID) {
  direction = direction ? 'up' : 'down'
  let possibleMatches = (await timetables.aggregate([
    {
      $match: {
        $or: [
          {runID},
          {lineName},
          {direction},
          {
            stopTimings: {
              $elemMatch: {
                stopGTFSID: stopGTFSID,
                departureTimeMinutes
              }
            }
          }
        ],
        mode: "metro train",
        operationDays: getDayName(scheduledDepartureTime),
        stopTimings: {
          $elemMatch: {
            stopGTFSID: stopGTFSID,
            departureTimeMinutes
          }
        }
      }
    },
    {
      $project: {
        _id: "$_id",
        score: {
          $add: [
            { $cond: [ { $eq: ["$runID", runID] }, 1, 0 ] },
            { $cond: [ { $eq: ["$lineName", lineName] }, 2, 0 ] },
            { $cond: [ { $eq: ["$direction", direction] }, 2, 0 ] }
          ]
        }
      }
    }
  ]).toArray()).sort((a, b) => b.score - a.score)
  if (!possibleMatches.length) {
    return null
  }
  let bestMatch = await timetables.findDocument({ _id: possibleMatches[0]._id })
  return bestMatch
}

async function getDepartures(station, db) {
  if (departuresCache.get(station.stopName)) {
    return departuresCache.get(station.stopName)
  }

  const timetables = db.getCollection('timetables')

  const now = moment().tz('Australia/Melbourne')
  const minutesPastMidnight = getMinutesPastMidnight(now)
  const today = daysOfWeek[now.day()]

  let transformedDepartures = []

  const metroPlatform = station.bays.filter(bay => bay.mode === 'metro train')[0]
  let {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/0/stop/${metroPlatform.stopGTFSID}?gtfs=true&max_results=10&include_cancelled=true&expand=run&expand=route`)

  await async.forEach(departures, async departure => {
    let run = runs[departure.run_id]
    let lineName = routes[departure.route_id].route_name
    if (lineName === 'Showgrounds - Flemington Racecourse') return
    // if (lineName === 'Showgrounds - Flemington Racecourse') lineName = 'Showgrounds/Flemington'
    let routeID = departure.route_id

    let scheduledDepartureTime = moment(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? moment(departure.estimated_departure_utc) : null
    let platform = departure.platform_number

    if (!run.vehicle_descriptor) return // run too far away

    let runID = run.vehicle_descriptor.id
    let vehicle = run.vehicle_descriptor.description

    let departureTimeMinutes = getMinutesPastMidnight(scheduledDepartureTime);
    if (departureTimeMinutes < 180) departureTimeMinutes += 1440

    let tripDirection
    tripDirection = cityLoopStations.includes(run.destination_name.toLowerCase()) || (routeID === 13 && run.destination_name === 'Frankston')

    let trip
    if (cityLoopStations.includes(station.stopName.toLowerCase().slice(0, -16)) && caulfieldGroup.includes(routeID)) {
      trip = await findTripFromStop(timetables, metroPlatform.stopGTFSID, departureTimeMinutes, scheduledDepartureTime, lineName, !tripDirection, runID)
    } else
      trip = await findTripFromStop(timetables, metroPlatform.stopGTFSID, departureTimeMinutes, scheduledDepartureTime, lineName, tripDirection, runID)

    if (!trip) return console.log(departure, run) // footy yay! when are we hooking it into GTFS data? probs never cos footy is over LOL
    // hmm well seems like sss is really good at this, turning werribee trains into frankston trains before they actually change
    // mtm timetable says starts from fss (Duh) but ptv says starts from sss
    let stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === metroPlatform.stopGTFSID)[0]
    offset = 0

    if (!stopData) return console.log(departure, run, trip)

    if (stopData.departureTimeMinutes < 180) { // train leaves < 3am
      offset = 1440 // add 1 day to departure time from today
    }

    trip.vehicle = vehicle

    let throughCityLoop = trip.runID.toString()[1] > 5 || cityLoopStations.includes(run.destination_name.toLowerCase());

    if (routeID == 6 && run.destination_name.toLowerCase() == 'southern cross') {
        throughCityLoop = false;
    }
    let stopsViaFlindersFirst = trip.runID.toString()[1] <= 5;
    upService = trip.direction === 'up'

    cityLoopConfig = [];

    // assume up trains
    if (northenGroup.includes(routeID)) {
        if (stopsViaFlindersFirst && !throughCityLoop)
            cityLoopConfig = ['NME', 'SSS', 'FSS'];
        else if (stopsViaFlindersFirst && throughCityLoop)
            cityLoopConfig = ['SSS', 'FSS', 'PAR', 'MCE', 'FGS'];
        else if (!stopsViaFlindersFirst && throughCityLoop)
            cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS'];
    } else {
        if (stopsViaFlindersFirst && throughCityLoop) { // flinders then loop
            if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID))
                cityLoopConfig = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR'];
        } else if (!stopsViaFlindersFirst && throughCityLoop) { // loop then flinders
            if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID))
                cityLoopConfig = ['PAR', 'MCE', 'FSG', 'SSS', 'FSS'];
        } else if (stopsViaFlindersFirst && !throughCityLoop) { // direct to flinders
            if (routeID == 6) // frankston
                cityLoopConfig = ['RMD', 'FSS', 'SSS']
            else if (burnleyGroup.concat(caulfieldGroup).includes(routeID))
                cityLoopConfig = ['RMD', 'FSS'];
            else if (cliftonHillGroup.includes(routeID))
                cityLoopConfig = ['JLI', 'FSS']
        }
    }

    if (!upService) { // down trains; away from city
        cityLoopConfig.reverse();
    }

    transformedDepartures.push({
      trip, scheduledDepartureTime, estimatedDepartureTime, platform, stopData,
      departureTimeMinutes: getMinutesPastMidnight(scheduledDepartureTime) + offset,
      cancelled: run.status === 'cancelled', cityLoopConfig, destination: run.destination_name
    })
  })

  transformedDepartures = transformedDepartures.sort((a, b) => {
    return (a.estimatedDepartureTime || a.scheduledDepartureTime) - (b.estimatedDepartureTime || b.scheduledDepartureTime)
  })

  departuresCache.put(station.stopName, transformedDepartures)
  return transformedDepartures
}

module.exports = getDepartures
