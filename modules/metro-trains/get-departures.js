const TimedCache = require('timed-cache')
const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })
const healthCheck = require('../health-check')
const moment = require('moment')
const departureUtils = require('../utils/get-train-timetables')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')

let ptvAPILocks = {}

let cityLoopStations = ['southern cross', 'parliament', 'flagstaff', 'melbourne central']

let burnleyGroup = [1, 2, 7, 9] // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12] // cranbourne, frankston, pakenham, sandringham
let northenGroup = [3, 14, 15, 16, 17, 1482] // craigieburn, sunbury, upfield, werribee, williamstown, flemington racecourse
let cliftonHillGroup = [5, 8] // mernda, hurstbridge
let crossCityGroup = [6, 16, 17, 1482]

function determineLoopRunning(routeID, runID, destination, isFormingNewTrip, isSCS) {
  if (routeID === 13) return [] // stony point

  let upService = !(runID[3] % 2)
  let throughCityLoop = runID[1] > 5 || cityLoopStations.includes(destination.toLowerCase())
  if (routeID === 6 && destination == 'Southern Cross' && isFormingNewTrip) {
    throughCityLoop = false
  }
  let stopsViaFlindersFirst = runID[1] <= 5

  cityLoopConfig = []
  // doublecheck showgrounds trains: R466 should be nme sss off but it show as sss fgs loop fss
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
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
        if (routeID === 99) cityLoopConfig.push('FSS')
    } else if (!stopsViaFlindersFirst && throughCityLoop) { // loop then flinders
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['PAR', 'MCE', 'FSG', 'SSS', 'FSS']
      if (routeID === 99) cityLoopConfig = ['FSS', ...cityLoopConfig]
    } else if (stopsViaFlindersFirst && !throughCityLoop) { // direct to flinders
      if (routeID == 6) // frankston
        cityLoopConfig = ['RMD', 'FSS', 'SSS']
      else if (burnleyGroup.concat(caulfieldGroup).includes(routeID))
        cityLoopConfig = ['RMD', 'FSS']
      else if (cliftonHillGroup.includes(routeID))
        cityLoopConfig = ['JLI', 'FSS']
    }
  }

  if (!upService || isFormingNewTrip) { // down trains away from city
    cityLoopConfig.reverse()
  }

  return cityLoopConfig
}

function mapSuspension(suspension) {
  let stationsAffected = suspension.description.match(/between ([ \w]+) and ([ \w]+) stations/)
  if (!stationsAffected) return
  let startStation = stationsAffected[1].trim() + ' Railway Station',
      endStation = stationsAffected[2].trim() + ' Railway Station'

  return {
    stationA: startStation,
    stationB: endStation
  }
}

function adjustSuspension(suspension, trip, currentStation) {
  let startStation, endStation

  if (trip.direction === 'Up') {
    startStation = suspension.stationB
    endStation = suspension.stationA
  } else {
    startStation = suspension.stationA
    endStation = suspension.stationB
  }

  let disruptionStatus = ''

  let tripStops = trip.stopTimings.map(stop => stop.stopName)
  let startIndex = tripStops.indexOf(startStation)
  let currentIndex = tripStops.indexOf(currentStation)
  let endIndex = tripStops.indexOf(endStation)

  if (currentIndex < startIndex) { // we're approaching disruption
    disruptionStatus = 'before'
  } else if (currentIndex == endIndex) { // we are at end of disruption
    disruptionStatus = 'passed'
  } else if (currentIndex < endIndex) { // we're inside disruption
    disruptionStatus = 'current'
  } else { // already passed
    disruptionStatus = 'passed'
  }

  return {
    startStation, endStation,
    disruptionStatus
  }
}

async function getDeparturesFromPTV(station, db, departuresCount, platform) {
  const gtfsTimetables = db.getCollection('gtfs timetables')
  const timetables = db.getCollection('timetables')
  const liveTimetables = db.getCollection('live timetables')

  const minutesPastMidnight = utils.getMinutesPastMidnightNow()
  let transformedDepartures = []

  const metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
  let {stopGTFSID} = metroPlatform
  const stationName = station.stopName.slice(0, -16).toLowerCase()
  const {departures, runs, routes, disruptions} = await ptvAPI(`/v3/departures/route_type/0/stop/${stopGTFSID}?gtfs=true&max_results=15&include_cancelled=true&expand=run&expand=route&expand=disruption`)

  let suspensionMap = {}
  let suspensionIDs = Object.values(disruptions).filter(disruption => {
    return disruption.disruption_type.toLowerCase().includes('suspend')
  }).map(suspension => {
    suspensionMap[suspension.disruption_id] = mapSuspension(suspension)
    return suspension.disruption_id
  })

  let stonyPointReplacements = Object.values(disruptions).filter(disruption => {
    if (disruption.routes.find(r => r.route_gtfs_id === '2-SPT')) {
      return disruption.description.includes('replace') && disruption.description.includes('fault')
    }
    return false
  }).map(disruption => {
    let text = disruption.description
    let service = text.match(/the (\d+:\d+[ap]m) ([ \w]*?) to ([ \w]*?) (?:train|service)/i)

    if (service) {
      let departureTime = service[1],
          origin = service[2],
          destination = service[3]

      let minutesPastMidnight = utils.time24ToMinAftMidnight(departureTime.slice(0, -2))
      if (departureTime.includes('pm')) minutesPastMidnight += 720

      return {
        departureTime: utils.minAftMidnightToTime24(minutesPastMidnight),
        origin, destination
      }
    }
  }).filter(Boolean)

  let replacementBusDepartures = []

  await async.forEachSeries(departures, async departure => {
    const run = runs[departure.run_id]
    let routeID = departure.route_id
    let routeName = routes[routeID].route_name
    if (routeName.includes('Showgrounds')) routeName = 'Showgrounds/Flemington'
    let platform = departure.platform_number
    let runDestination = utils.adjustStopname(run.destination_name)
    let cancelled = run.status === 'cancelled'
    let isTrainReplacement = false

    let suspensions = departure.disruption_ids.map(id => suspensionMap[id]).filter(Boolean)

    if (platform == null) { // show replacement bus
      isTrainReplacement = departure.flags.includes('RRB-RUN')
      run.vehicle_descriptor = {}
    }

    if (routeID === 13 && !isTrainReplacement) { // stony point platforms
      if (station.stopName === 'Frankston Railway Station') platform = '3'
      else platform = '1'
      run.vehicle_descriptor = {} // ok maybe we should have kept the STY timetable but ah well
    }

    if (!platform && !isTrainReplacement) return // run too far away
    const runID = run.vehicle_descriptor.id
    const vehicleType = run.vehicle_descriptor.description

    const scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    const scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    let estimatedDepartureTime = departure.estimated_departure_utc ? moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne') : null

    let possibleDestinations = [runDestination]

    let destination = runDestination
    if (routeName === 'Frankston' && (destination === 'Southern Cross' || destination === 'Parliament'))
      possibleDestinations.push('Flinders Street')

    let possibleLines = [routeName]
    if (cityLoopStations.includes(stationName) || destination !== routeName) {
      if (burnleyGroup.includes(routeID))
        possibleLines = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
      else if (caulfieldGroup.includes(routeID))
        possibleLines = ['Cranbourne', 'Pakenham', 'Frankston', 'Sandringham']
      else if (crossCityGroup.includes(routeID))
        possibleLines = ['Frankston', 'Werribee', 'Williamstown']
      else if (cliftonHillGroup.includes(routeID))
        possibleLines = ['Mernda', 'Hurstbridge']
      if (northenGroup.includes(routeID))
        possibleLines = [...possibleLines, 'Sunbury', 'Craigieburn', 'Upfield', 'Showgrounds/Flemington', 'Werribee', 'Williamstown']
      if (routeID == 6)
        possibleLines = [...possibleLines, 'Cranbourne', 'Pakenham']

      if (routeID == 99)
        possibleLines = ['City Loop']

      possibleDestinations.push('Flinders Street')
    } else {
      if ((routeName === 'Pakenham' || routeName === 'Cranbourne') && destination === 'Parliament') {
        possibleDestinations.push('Flinders Street')
      }
    }

    // gtfs timetables
    possibleDestinations = possibleDestinations.map(dest => dest + ' Railway Station')
    let trip = await departureUtils.getLiveDeparture(station, db, 'metro train', possibleLines,
      scheduledDepartureTimeMinutes, possibleDestinations)

    if (!trip) {
      trip = await departureUtils.getScheduledDeparture(station, db, 'metro train', possibleLines,
        scheduledDepartureTimeMinutes, possibleDestinations)
    }

    if (!trip) { // static dump
        // let isCityLoop = cityLoopStations.includes(stationName) || stationName === 'flinders street'
        trip = await departureUtils.getStaticDeparture(runID, db)
        if (trip) {
          let stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === stopGTFSID)[0]
          if (!stopData || stopData.departureTimeMinutes !== scheduledDepartureTimeMinutes)
            trip = null
        }
    }

    if (!trip) { // still no match - getStoppingPattern
      if (replacementBusDepartures.includes(scheduledDepartureTimeMinutes)) {
        if (isTrainReplacement && suspensions.length === 0) return // ok this is risky but bus replacements actually seem to do it the same way as vline
      }
      trip = await getStoppingPattern(db, departure.run_id, 'metro train')
    } else {
      replacementBusDepartures.push(scheduledDepartureTimeMinutes)
    }

    if (stonyPointReplacements.length) {
      let replacement = stonyPointReplacements.find(r => {
        return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime
      })
      if (replacement) isTrainReplacement = true
    }

    let isFormingNewTrip = cityLoopStations.includes(stationName) && destination !== trip.destination.slice(0, -16)
    let isSCS = station.stopName.slice(0, -16) === 'Southern Cross'

    let isUpTrip = ((trip || {}).direction === 'Up' || runID % 2 === 0) && !isFormingNewTrip
    let cityLoopConfig = !isTrainReplacement ? determineLoopRunning(routeID, runID, runDestination, isFormingNewTrip, isSCS) : []

    if (isUpTrip && !cityLoopStations.includes(runDestination.toLowerCase()) &&
      !cityLoopStations.includes(stationName) && runDestination !== 'Flinders Street')
      cityLoopConfig = []

    if (cityLoopStations.includes(stationName) && !cityLoopConfig.includes('FGS')) {
      if (caulfieldGroup.includes(routeID) && isUpTrip)
        cityLoopConfig = ['PAR', 'MCE', 'FSG', 'SSS', 'FSS']
        // trip is towards at flinders, but ptv api already gave next trip
        // really only seems to happen with cran/pak/frank lines
      if (!crossCityGroup.includes(routeID) && northenGroup.includes(routeID)) {// all northern group except showgrounds & cross city
        if (runDestination !== 'Flinders Street')
          cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
      }
    }

    if (isUpTrip && !cityLoopStations.includes(stationName)) {
      if (cityLoopConfig[0] === 'FSS' || cityLoopConfig[1] === 'FSS')
        destination = 'Flinders Street'
      else if (['PAR', 'FGS'].includes(cityLoopConfig[0]) && !cityLoopStations.includes(stationName))
        destination = 'City Loop'
      else if (cityLoopConfig.slice(-1)[0] === 'SSS')
        destination = 'Southern Cross'
    }

    let forming = null
    if (isFormingNewTrip) {
      forming = await departureUtils.getStaticDeparture(runID, db)
      if (!forming || (forming.destination !== trip.destination + ' Railway Station')) {
        trip = await getStoppingPattern(db, departure.run_id, 'metro train')
        forming = null
      }
    }

    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
    let mappedSuspensions = suspensions.map(e => adjustSuspension(e, forming || trip, station.stopName))
    if (mappedSuspensions.length) {
      let firstSuspension = mappedSuspensions.find(suspension => suspension.disruptionStatus !== 'passed')
      if (firstSuspension) {
        trip.message = `Buses replace trains from ${firstSuspension.startStation.slice(0, -16)} to ${firstSuspension.endStation.slice(0, -16)}`

        if (!isTrainReplacement) {
          isTrainReplacement = !!mappedSuspensions.find(suspension => suspension.disruptionStatus === 'current')
        }
      }
    }

    transformedDepartures.push({
      trip,
      scheduledDepartureTime,
      estimatedDepartureTime,
      actualDepartureTime,
      platform,
      isTrainReplacement,
      cancelled, cityLoopConfig,
      destination, runID, forming, vehicleType, runDestination,
      suspensions: mappedSuspensions
    })
  })

  return transformedDepartures
}

function filterDepartures(departures, filter) {
  if (filter) {
    let now = utils.now()
    departures = departures.filter(departure => {
      let secondsDiff = departure.actualDepartureTime.diff(now, 'seconds')

      return -30 < secondsDiff && secondsDiff < 7200 // 2 hours
    })
  }

  return departures.sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime
  })
}

async function getDepartures(station, db, filter=true) {
  let cacheKey = station.stopName + 'M'

  if (ptvAPILocks[cacheKey]) {
    return await new Promise(resolve => {
      ptvAPILocks[cacheKey].on('done', data => {
        resolve(data)
      })
    })
  }

  if (departuresCache.get(cacheKey)) {
    return filterDepartures(departuresCache.get(cacheKey), filter)
  }

  ptvAPILocks[cacheKey] = new EventEmitter()

  function returnDepartures(departures) {
    ptvAPILocks[cacheKey].emit('done', departures)
    delete ptvAPILocks[cacheKey]

    return departures
  }

  try {
    let departures = await getDeparturesFromPTV(station, db)

    let serviceIDs = []
    let mergedDepartures = {}

    departures.forEach(departure => {
      let serviceID = departure.scheduledDepartureTime.format('HH:mm') + departure.trip.destination + departure.trip.destinationArrivalTime

      if (serviceIDs.includes(serviceID))
        mergedDepartures[serviceID].busCount++
      else {
        departure.busCount = 1
        mergedDepartures[serviceID] = departure
        serviceIDs.push(serviceID)
      }
    })

    departuresCache.put(cacheKey, Object.values(mergedDepartures))
    return returnDepartures(filterDepartures(Object.values(mergedDepartures), filter))
  } catch (e) {
    try {
      let scheduled = await departureUtils.getScheduledDepartures(station, db, 'metro train', 120)
      return returnDepartures(scheduled)
    } catch (ee) {
      return returnDepartures(null)
    }
  }
}

module.exports = getDepartures
