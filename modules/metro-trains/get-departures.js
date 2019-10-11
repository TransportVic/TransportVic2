const TimedCache = require('timed-cache')
const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 3 })
const healthCheck = require('../health-check')
const moment = require('moment')
const getScheduledDepartures = require('./get-scheduled-departures')

let cityLoopStations = ['southern cross', 'parliament', 'flagstaff', 'melbourne central']

let burnleyGroup = [1, 2, 7, 9] // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12] // cranbourne, frankston, pakenham, sandringham
let northenGroup = [3, 14, 15, 16, 17, 1482] // craigieburn, sunbury, upfield, werribee, williamstown, flemington racecourse
let cliftonHillGroup = [5, 8] // mernda, hurstbridge

function determineLoopRunning(routeID, runID, destination) {
  if (routeID === 13) return []

  let upService = !(runID[3] % 2)
  let throughCityLoop = runID[1] > 5 || cityLoopStations.includes(destination.toLowerCase())
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

async function getDeparturesFromPTV(station, db, departuresCount, includeCancelled, platform, ttl) {
  const gtfsTimetables = db.getCollection('gtfs timetables')
  const timetables = db.getCollection('timetables')
  const liveTimetables = db.getCollection('live timetables')

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
    let cancelled = run.status === 'cancelled'

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
    const vehicleType = run.vehicle_descriptor.description

    const scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    const scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    let departureHour = scheduledDepartureTime.get('hour')

    let cutoff = 90
    if (cityLoopStations.includes(stationName) || stationName == 'flinders street')
      cutoff = 60

    if (scheduledDepartureTime.diff(utils.now(), 'minutes') > cutoff) { // show only up to next 1.5 hr of departures
      return
    }

    let estimatedDepartureTime = departure.estimated_departure_utc ? moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne') : null

    let possibleDestinations = [runDestination]

    let destination = runDestination
    if (routeName === 'Frankston' && (destination === 'Southern Cross' || destination === 'Parliament'))
      possibleDestinations.push('Flinders Street')

    let possibleLines = [routeName]
    if (cityLoopStations.includes(stationName) || destination !== routeName) {

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

    let trip = cancelled ? [] : await liveTimetables.findDocuments({
      routeName: {
        $in: possibleLines
      },
      operationDay: utils.getYYYYMMDDNow(),
      mode: "metro train",
      stopTimings: {
        $elemMatch: {
          stopGTFSID: metroPlatform.stopGTFSID,
          departureTimeMinutes: scheduledDepartureTimeMinutes
        }
      }
    }).toArray()

    if (trip.length) {
      if (trip[0].type === 'suspension') {
        if (trip.length > 1) {
          trip = trip.sort((a, b) => b.stopTimings[0].departureTimeMinutes - a.stopTimings[0].departureTimeMinutes).slice(0, 1)
        }

        destination = trip[0].destination.slice(0, -16)
        runDestination = destination
        if (trip[0].vehicle == 'Replacement Bus') {
          platform = 'RRB'
          estimatedDepartureTime = null
        }
      }
    } else
      trip = await gtfsTimetables.findDocuments({
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
        },
        tripStartHour: {
          $lte: departureHour
        },
        tripEndHour: {
          $gte: departureHour
        }
      }, {tripStartHour: 0, tripEndHour: 0}).limit(2).toArray()

    if (!trip.length)
      trip = [await timetables.findDocument({
        runID
      })]

    trip = trip.sort((a, b) => utils.time24ToMinAftMidnight(b.departureTime) - utils.time24ToMinAftMidnight(a.departureTime))[0]

    if (!trip) {
      return transformedDepartures.push({
        trip: {
          routeName,
          stopTimings: [],
          destination,
          isUncertain: true
        },
        estimatedDepartureTime,
        platform,
        stopData: {},
        scheduledDepartureTime,
        actualDepartureTime: estimatedDepartureTime || scheduledDepartureTime,
        runID,
        cityLoopConfig: [],
        destination: runDestination,
        vehicleType
      })
    }

    let cityLoopConfig = platform !== 'RRB' ? determineLoopRunning(routeID, runID, runDestination) : []

    if (trip.direction === 'Up' && !cityLoopStations.includes(runDestination.toLowerCase()) && !(cityLoopStations.includes(stationName) || runDestination === 'Flinders Street'))
      cityLoopConfig = []

    trip.destination = trip.destination.slice(0, -16)

    if (cityLoopStations.includes(stationName) && !cityLoopConfig.includes('SSS')) {
      if (caulfieldGroup.includes(routeID))
        cityLoopConfig = ['PAR', 'MCE', 'FSG', 'SSS', 'FSS']
      // trip is towards at flinders, but ptv api already gave next trip
      // really only seems to happen with cran/pak/frank lines
    }

    if (trip.direction === 'Up' && !cityLoopStations.includes(stationName)) {
      if (cityLoopConfig[0] === 'FSS' || cityLoopConfig[1] === 'FSS')
        destination = 'Flinders Street'
      else if (cityLoopConfig[0] === 'PAR' && !cityLoopStations.includes(stationName))
        destination = 'City Loop'
      else if (cityLoopConfig.slice(-1)[0] === 'SSS')
        destination = 'Southern Cross'
    }
    let forming = null

    if (cityLoopStations.includes(stationName) && destination !== trip.destination) {
      forming = await timetables.findDocument({
        runID
      })
      if (forming)
        destination = forming.destination.slice(0, -16)
    }

    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
    transformedDepartures.push({
      trip, scheduledDepartureTime, estimatedDepartureTime, actualDepartureTime, platform,
      cancelled, cityLoopConfig,
      destination, runID, forming, vehicleType
    })
  })

  return transformedDepartures
}

function filterDepartures(departures) {
  return departures.sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime
  }).filter(departure =>
    departure.actualDepartureTime.diff(utils.now(), 'seconds') > -30
  )
}

async function getDepartures(station, db, departuresCount=6, includeCancelled=true, platform=null, ttl=2) {
  let cacheKey = station.stopName + 'M-' + departuresCount + '-' + includeCancelled + '-' + platform

  if (departuresCache.get(cacheKey)) {
    return filterDepartures(departuresCache.get(cacheKey))
  }

  if (!healthCheck.isOnline()) return await getScheduledDepartures(station, db)

  let departures = await getDeparturesFromPTV(station, db, departuresCount, includeCancelled, platform, ttl)
  departuresCache.put(cacheKey, departures, {
    ttl: ttl * 1000 * 60
  })

  return filterDepartures(departures)
}

module.exports = getDepartures
