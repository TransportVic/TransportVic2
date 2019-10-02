const TimedCache = require('timed-cache')
const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })
const moment = require('moment')

let cityLoopStations = ['southern cross', 'parliament', 'flagstaff', 'melbourne central']

let burnleyGroup = [1, 2, 7, 9] // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12] // cranbourne, frankston, pakenham, sandringham
let northenGroup = [3, 14, 15, 16, 17, 1482] // craigieburn, sunbury, upfield, werribee, williamstown, flemington racecourse
let cliftonHillGroup = [5, 8] // mernda, hurstbridge

function determineLoopRunning(routeID, runID, destination) {
  if (routeID === 13) return []

  let upService = cityLoopStations.includes(destination.toLowerCase()) || destination === 'Flinders Street'
  let throughCityLoop = runID[1] > 5 || upService

  if (routeID === 6 && destination == 'Southern Cross') {
    throughCityLoop = false
  }
  let stopsViaFlindersFirst = runID[1] <= 5

  cityLoopConfig = []

  // assume up trains
  if (northenGroup.includes(routeID)) {
    if (stopsViaFlindersFirst && !throughCityLoop)
    cityLoopConfig = ['NME', 'SSS', 'FSS']
    else if (stopsViaFlindersFirst && throughCityLoop)
    cityLoopConfig = ['SSS', 'FSS', 'PAR', 'MCE', 'FGS']
    else if (!stopsViaFlindersFirst && throughCityLoop)
    cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
  } else {
    if (stopsViaFlindersFirst && throughCityLoop) { // flinders then loop
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID))
      cityLoopConfig = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
    } else if (!stopsViaFlindersFirst && throughCityLoop) { // loop then flinders
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID))
      cityLoopConfig = ['PAR', 'MCE', 'FSG', 'SSS', 'FSS']
    } else if (stopsViaFlindersFirst && !throughCityLoop) { // direct to flinders
      if (routeID == 6) // frankston
      cityLoopConfig = ['RMD', 'FSS', 'SSS']
      else if (burnleyGroup.concat(caulfieldGroup).includes(routeID))
      cityLoopConfig = ['RMD', 'FSS']
      else if (cliftonHillGroup.includes(routeID))
      cityLoopConfig = ['JLI', 'FSS']
    }
  }

  if (!upService) { // down trains away from city
    cityLoopConfig.reverse()
  }

  return cityLoopConfig
}

async function getDepartures(station, db, departuresCount=6, includeCancelled=true, platform=null, ttl=2) {
  let cacheKey = station.stopName + 'M-' + departuresCount + '-' + includeCancelled + '-' + platform

  if (departuresCache.get(cacheKey)) {
    return departuresCache.get(cacheKey)
  }

  const gtfsTimetables = db.getCollection('gtfs timetables')
  const timetables = db.getCollection('timetables')

  const minutesPastMidnight = utils.getMinutesPastMidnightNow()
  let transformedDepartures = []

  const metroPlatform = station.bays.filter(bay => bay.mode === 'metro train')[0]
  const stationName = station.stopName.slice(0, -16).toLowerCase()
  const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/0/stop/${metroPlatform.stopGTFSID}?gtfs=true&max_results=${departuresCount}&include_cancelled=${includeCancelled}&expand=run&expand=route${platform ? `&platform_numbers=${platform}` : ''}`)

  await async.forEach(departures, async departure => {
    const run = runs[departure.run_id]
    let routeID = departure.route_id
    let routeName = routes[routeID].route_name
    if (routeName === 'Showgrounds - Flemington Racecourse') routeName = 'Showgrounds/Flemington'
    let platform = departure.platform_number
    let runDestination = run.destination_name

    if (platform == null) { // show replacement bus
      if (departure.flags.includes('RRB-RUN')) platform = 'RRB';
      run.vehicle_descriptor = {}
    }

    if (routeID === 13) { // stony point platforms
      if (station.stopName === 'Frankston Railway Station') platform = 3;
      else platform = 1;
      run.vehicle_descriptor = {} // ok maybe we should have kept the STY timetable but ah well
    }

    if (!platform) return // run too far away
    const runID = run.vehicle_descriptor.id

    const scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    const scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    if (scheduledDepartureTime.diff(utils.now(), 'minutes') > 90) { // show only up to next 1.5 hr of departures
      return
    }

    const estimatedDepartureTime = departure.estimated_departure_utc ? moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne') : null

    let possibleDestinations = [runDestination]

    let destination = runDestination
    if (routeName === 'Frankston' && (destination === 'Southern Cross' || destination === 'Parliament'))
      possibleDestinations.push('Flinders Street')

    let possibleLines = [routeName]
    if (cityLoopStations.includes(stationName)) {

      if ([1, 2, 7, 9].includes(routeID))
        possibleLines = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
      else if ([4, 11].includes(routeID))
        possibleLines = ['Cranbourne', 'Pakenham', 'Frankston']
      else if ([6, 16, 17].includes(routeID))
        possibleLines = ['Frankston', 'Werribee', 'Williamstown']
      else if ([5, 8].includes(routeID))
        possibleLines = ['Mernda', 'Hurstbridge']
      else if ([3, 15].includes(routeID))
        possibleLines = ['Craigieburn', 'Upfield']
      if (routeID == 6)
        possibleLines = possibleLines.concat(['Cranbourne', 'Pakenham'])

      possibleDestinations.push('Flinders Street')
    } else {
      if (routeName === 'Pakenham' || routeName === 'Cranbourne' && destination === 'Parliament') {
        possibleDestinations.push('Flinders Street')
      }
    }

    let trip = (await gtfsTimetables.findDocuments({
      routeName: {
        $in: possibleLines
      },
      destination: {
        $in: possibleDestinations.map(dest => dest + ' Railway Station')
      },
      operationDays: utils.getYYYYMMDDNow(),
      mode: "metro train",
      stopTimings: {
        $elemMatch: {
          stopGTFSID: metroPlatform.stopGTFSID,
          departureTimeMinutes: scheduledDepartureTimeMinutes
        }
      }
    }).limit(2).toArray())
    if (!trip.length)
      trip = [await timetables.findDocument({
        runID
      })]

    trip = trip.sort((a, b) => utils.time24ToMinAftMidnight(b.departureTime) - utils.time24ToMinAftMidnight(a.departureTime))[0]

    if (!trip) return console.log(departure, run, {
      routeName: {
        $in: possibleLines
      },
      destination: {
        $in: possibleDestinations.map(dest => dest + ' Railway Station')
      },
      operationDays: utils.getYYYYMMDDNow(),
      mode: "metro train",
      stopTimings: {
        $elemMatch: {
          stopGTFSID: metroPlatform.stopGTFSID,
          departureTimeMinutes: scheduledDepartureTimeMinutes
        }
      }
    })

    let cityLoopConfig = platform !== 'RRB' ? determineLoopRunning(routeID, runID, runDestination) : []

    trip.destination = trip.destination.slice(0, -16)

    if (cityLoopStations.includes(stationName) && run.destination !== trip.destination) {
      // trip is towards at flinders, but ptv api already gave next trip
      // really only seems to happen with cran/pak/frank lines
      cityLoopConfig = ['PAR', 'MCE', 'FSG', 'SSS', 'FSS']
    }

    if (trip.direction === 'Up') {
      if (cityLoopConfig[0] === 'FSS' || cityLoopConfig[1] === 'FSS')
        destination = 'Flinders Street'
      else if (cityLoopConfig[0] === 'PAR')
        destination = 'City Loop'
      else if (cityLoopConfig.slice(-1)[0] === 'SSS')
        destination = 'Southern Cross'
    }

    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
    transformedDepartures.push({
      trip, scheduledDepartureTime, estimatedDepartureTime, actualDepartureTime, platform,
      scheduledDepartureTimeMinutes, cancelled: run.status === 'cancelled', cityLoopConfig,
      destination, runID
    })
  })

  transformedDepartures = transformedDepartures.sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime
  }).filter(departure =>
    departure.actualDepartureTime.diff(utils.now(), 'seconds') > -30
  )

  departuresCache.put(cacheKey, transformedDepartures, {
    ttl: ttl * 1000 * 60
  })
  return transformedDepartures
}

module.exports = getDepartures
