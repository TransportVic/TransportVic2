const TimedCache = require('timed-cache')
const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 30 })
const moment = require('moment')
const departureUtils = require('../utils/get-train-timetables')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')

const getRouteStops = require('../../additional-data/route-stops')
const getStonyPoint = require('../get-stony-point')

let ptvAPILocks = {}

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

let burnleyGroup = [1, 2, 7, 9] // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12] // cranbourne, frankston, pakenham, sandringham
let northernGroup = [3, 14, 15, 16, 17, 1482] // craigieburn, sunbury, upfield, werribee, williamstown, flemington racecourse
let cliftonHillGroup = [5, 8] // mernda, hurstbridge
let crossCityGroup = [6, 16, 17, 1482]

function determineLoopRunning(routeID, runID, destination, isFormingNewTrip, isSCS) {
  if (routeID === 13) return [] // stony point

  let upService = !(runID[3] % 2)
  let throughCityLoop = runID[1] > 5 || cityLoopStations.includes(destination) && destination !== 'Southern Cross'
  if (routeID === 6 && destination == 'Southern Cross' && isFormingNewTrip) {
    throughCityLoop = false
  }
  let stopsViaFlindersFirst = runID[1] <= 5

  cityLoopConfig = []
  // doublecheck showgrounds trains: R466 should be nme sss off but it show as sss fgs loop fss
  // assume up trains
  if (northernGroup.includes(routeID)) {
    if (destination === 'Southern Cross')
      cityLoopConfig = ['NME', 'SSS']
    else if (stopsViaFlindersFirst && !throughCityLoop)
      cityLoopConfig = ['NME', 'SSS', 'FSS']
    else if (stopsViaFlindersFirst && throughCityLoop)
      cityLoopConfig = ['SSS', 'FSS', 'PAR', 'MCE', 'FGS']
    else if (!stopsViaFlindersFirst && throughCityLoop)
      cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
  } else {
    if (stopsViaFlindersFirst && throughCityLoop) { // flinders then loop
      if (routeID === 6) // frankston
        cityLoopConfig = ['RMD', 'FSS', 'SSS']
      else if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
        if (routeID === 99) cityLoopConfig.push('FSS')
    } else if (!stopsViaFlindersFirst && throughCityLoop) { // loop then flinders
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
      if (routeID === 99) cityLoopConfig = ['FSS', ...cityLoopConfig]
    } else if (stopsViaFlindersFirst && !throughCityLoop) { // direct to flinders
      if (routeID === 6 && isSCS)
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

function mapSuspension(suspension, routeName) {
  let stationsAffected = suspension.description.replace(/\u00A0/g, ' ').match(/between ([ \w]+) and ([ \w]+) stations/i)

  if (!stationsAffected) return
  let startStation = stationsAffected[1].trim()
  let endStation = stationsAffected[2].trim()

  // Station A should always be on the UP end
  let routeStops = getRouteStops(routeName)
  let startIndex = routeStops.indexOf(startStation)
  let endIndex = routeStops.indexOf(endStation)

  if (endIndex < startIndex) {
    let c = startStation
    startStation = endStation
    endStation = c
  }

  return {
    stationA: startStation + ' Railway Station',
    stationB: endStation + ' Railway Station',
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
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')

  let minutesPastMidnight = utils.getMinutesPastMidnightNow()
  let transformedDepartures = []

  let now = utils.now()

  let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
  let {stopGTFSID} = metroPlatform
  let stationName = station.stopName.slice(0, -16)
  let {departures, runs, routes, disruptions} = await ptvAPI(`/v3/departures/route_type/0/stop/${stopGTFSID}?gtfs=true&max_results=15&include_cancelled=true&expand=run&expand=route&expand=disruption&expand=VehicleDescriptor`)

  let suspensionMap = {}
  let suspensionIDs = Object.values(disruptions).filter(disruption => {
    return disruption.disruption_type.toLowerCase().includes('suspend')
  }).map(suspension => {
    suspensionMap[suspension.disruption_id] = mapSuspension(suspension, suspension.routes[0].route_name)
    return suspension.disruption_id
  })

  function matchService(disruption) {
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
        origin, destination,
        originalText: text
      }
    }
  }

  let stonyPointReplacements = Object.values(disruptions).filter(disruption => {
    if (disruption.routes.find(r => r.route_gtfs_id === '2-SPT')) {
      return disruption.description.includes('replace')
    }
    return false
  }).map(matchService).filter(Boolean)

  let shortMap = {}

  Object.values(disruptions).filter(disruption => {
    return disruption.description.includes('originate') || disruption.description.includes('terminate')
  }).map(matchService).filter(Boolean).map(disruption => {
    let parts = disruption.originalText.match(/will (?:now )?(\w+) (?:from|at) (.*)./)
    if (parts) {
      let type = parts[1]
      let point = parts[2]

      let serviceID = `${disruption.origin}-${disruption.destination}-${disruption.departureTime}`

      shortMap[serviceID] = { type, point }
    }
  })

  let cityLoopSkipping = Object.values(disruptions).filter(disruption => {
    let description = disruption.description.toLowerCase()
    return description.includes('direct to') && description.includes('not via the city loop') && !description.includes('maint') && disruption.disruption_type !== 'Planned Works'
  })

  let servicesSkippingLoop = []
  let linesSkippingLoop = []

  cityLoopSkipping.forEach(disruption => {
    let service = matchService(disruption)
    if (service) servicesSkippingLoop.push(service)
    else {
      linesSkippingLoop = linesSkippingLoop.concat(disruption.routes.map(r => r.route_gtfs_id))
    }
  })

  // PTV likes to leave stuff out

  if (linesSkippingLoop.includes('2-HBG') || linesSkippingLoop.includes('2-MER')) {
    linesSkippingLoop = linesSkippingLoop.concat(['2-HBG', '2-MER'])
  }

  if (linesSkippingLoop.includes('2-BEL') || linesSkippingLoop.includes('2-LIL') || linesSkippingLoop.includes('2-GLW') || linesSkippingLoop.includes('2-ALM')) {
    linesSkippingLoop = linesSkippingLoop.concat(['2-BEL', '2-LIL', '2-GLW', '2-ALM'])
  }

  if (linesSkippingLoop.includes('2-CRB') || linesSkippingLoop.includes('2-PKM') || linesSkippingLoop.includes('2-FKN') || linesSkippingLoop.includes('2-SDM')) {
    linesSkippingLoop = linesSkippingLoop.concat(['2-CRB', '2-PKM', '2-FKN', '2-SDM'])
  }

  if (linesSkippingLoop.includes('2-WBE') || linesSkippingLoop.includes('2-WMN') || linesSkippingLoop.includes('2-UFD') || linesSkippingLoop.includes('2-B31') || linesSkippingLoop.includes('2-SYM')) {
    linesSkippingLoop = linesSkippingLoop.concat(['2-WBE', '2-WMN', '2-UFD', '2-B31', '2-SYM'])
  }

  let replacementBuses = departures.filter(departure => departure.flags.includes('RRB-RUN'))
  let trains = departures.filter(departure => !departure.flags.includes('RRB-RUN'))

  let replacementBusDepartures = replacementBuses.map(bus => {
    let scheduledDepartureTime = utils.parseTime(bus.scheduled_departure_utc)
    return utils.getPTMinutesPastMidnight(scheduledDepartureTime)
  })

  async function processDeparture(departure) {
    let run = runs[departure.run_id]
    let routeID = departure.route_id
    let routeName = routes[routeID].route_name
    if (routeName.includes('Showgrounds')) routeName = 'Showgrounds/Flemington'
    let platform = departure.platform_number
    let runDestination = utils.adjustStopName(run.destination_name)
    let cancelled = run.status === 'cancelled'
    let isRailReplacementBus = false

    let suspensions = departure.disruption_ids.map(id => suspensionMap[id]).filter(Boolean)

    if (platform == null) { // show replacement bus
      isRailReplacementBus = departure.flags.includes('RRB-RUN')
      run.vehicle_descriptor = {}
    }

    if (routeID === 13 && !isRailReplacementBus) { // stony point platforms
      if (station.stopName === 'Frankston Railway Station') platform = '3'
      else platform = '1'
      run.vehicle_descriptor = {} // ok maybe we should have kept the STY timetable but ah well
    }

    if (!platform && !isRailReplacementBus) return

    const runID = run.vehicle_descriptor.id || ''
    const vehicleType = run.vehicle_descriptor.description

    const scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    const scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    if (scheduledDepartureTime.diff(now, 'minutes') > 150) return

    let consist = []

    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

    let possibleDestinations = [runDestination]

    let destination = runDestination
    if (caulfieldGroup.includes(routeID) && destination === 'Southern Cross' || destination === 'Parliament')
      possibleDestinations.push('Flinders Street')

    let possibleLines = [routeName]

    if (cityLoopStations.includes(stationName) || isRailReplacementBus) {
      if (burnleyGroup.includes(routeID))
        possibleLines = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
      else if (caulfieldGroup.includes(routeID))
        possibleLines = ['Cranbourne', 'Pakenham', 'Frankston', 'Sandringham']
      else if (crossCityGroup.includes(routeID))
        possibleLines = ['Frankston', 'Werribee', 'Williamstown']
      else if (cliftonHillGroup.includes(routeID))
        possibleLines = ['Mernda', 'Hurstbridge']
      if (northernGroup.includes(routeID))
        possibleLines = [...possibleLines, 'Sunbury', 'Craigieburn', 'Upfield', 'Showgrounds/Flemington', 'Werribee', 'Williamstown']
      if (routeID == 6)
        possibleLines = [...possibleLines, 'Cranbourne', 'Pakenham']

      possibleDestinations.push('Flinders Street')
    } else {
      if ((routeName === 'Pakenham' || routeName === 'Cranbourne') && destination === 'Parliament') {
        possibleDestinations.push('Flinders Street')
      }
    }

    if (routeID == 99)
      possibleLines = ['City Circle']

    // gtfs timetables
    possibleDestinations = possibleDestinations.map(dest => dest + ' Railway Station')

    let usedLive = false
    let isUpTrip = runID.slice(1) % 2 === 0
    if (routeName === 'Stony Point') {
      isUpTrip = destination === 'Frankston'
    }

    let direction = isUpTrip ? 'Up' : 'Down'
    if (isRailReplacementBus) direction = { $in: ['Up', 'Down'] }

    let isFormingNewTrip = cityLoopStations.includes(stationName) && destination !== 'Flinders Street'
    let isSCS = stationName === 'Southern Cross'
    let isFSS = stationName === 'Flinders Street'

    // let isUpTrip = ((trip || {}).direction === 'Up' || runID % 2 === 0) && !isFormingNewTrip
    let cityLoopConfig = !isRailReplacementBus ? determineLoopRunning(routeID, runID, runDestination, isFormingNewTrip, isSCS) : []

    if (isUpTrip && !cityLoopStations.includes(runDestination) &&
      !cityLoopStations.includes(stationName) && runDestination !== 'Flinders Street')
      cityLoopConfig = []

    if (cityLoopStations.includes(stationName) && !cityLoopConfig.includes('FGS')) {
      if (caulfieldGroup.includes(routeID) || burnleyGroup.includes(routeID))
        cityLoopConfig = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
        // trip is towards at flinders, but ptv api already gave next trip
        // really only seems to happen with cran/pak/frank lines
      if (!crossCityGroup.includes(routeID) && northernGroup.includes(routeID)) {// all northern group except showgrounds & cross city
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

    let viaCityLoop = isFSS ? cityLoopConfig.includes('FGS') : undefined

    let trip = await departureUtils.getLiveDeparture(station, db, 'metro train', possibleLines,
      scheduledDepartureTime, possibleDestinations, direction, viaCityLoop)

    if (!trip) {
      trip = await departureUtils.getScheduledDeparture(station, db, 'metro train', possibleLines,
        scheduledDepartureTime, possibleDestinations, direction, viaCityLoop)
    } else {
      usedLive = true
    }

    if (!trip) { // static dump
      // let isCityLoop = cityLoopStations.includes(stationName) || stationName === 'flinders street'
      trip = await departureUtils.getStaticDeparture(runID, db)
      if (trip) {
        let stopData = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
        if (!stopData || stopData.departureTimeMinutes !== scheduledDepartureTimeMinutes)
          trip = null
        else if (!possibleDestinations.includes(trip.destination))
          trip = null
      }
    }

    if (!trip) { // still no match - getStoppingPattern
      if (replacementBusDepartures.includes(scheduledDepartureTimeMinutes)) {
        if (isRailReplacementBus && suspensions.length === 0) return // ok this is risky but bus replacements actually seem to do it the same way as vline
      }

      trip = await getStoppingPattern(db, departure.run_id, 'metro train', scheduledDepartureTime.toISOString())
      usedLive = true
    }

    if (!usedLive) {
      let origin = trip.trueOrigin.slice(0, -16)
      let destination = trip.trueDestination.slice(0, -16)

      let serviceID = `${origin}-${destination}-${trip.trueDepartureTime}`
      if (shortMap[serviceID]) trip = await getStoppingPattern(db, departure.run_id, 'metro train', scheduledDepartureTime.toISOString())
    }

    if (stonyPointReplacements.length) {
      let replacement = stonyPointReplacements.find(r => {
        return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime
      })
      if (replacement) isRailReplacementBus = true
    }

    let skippingLoop = servicesSkippingLoop.find(r => {
      return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime && r.destination === trip.destination.slice(0, -16)
    })

    let willSkipLoop = skippingLoop || linesSkippingLoop.includes(routes[routeID].route_gtfs_id)
    if (willSkipLoop) {
      if (cityLoopStations.includes(stationName)) {
        if (northernGroup.includes(routeID)) {
          if (!isSCS) return
        } else return
      }

      if (northernGroup.includes(routeID)) cityLoopConfig = ['NME', 'SSS', 'FSS']
      else if (cliftonHillGroup.includes(routeID)) cityLoopConfig = ['JLI', 'FSS']
      else cityLoopConfig = ['RMD', 'FSS']

      if (trip.direction === 'Up') {
        destination = 'Flinders Street'
      } else {
        cityLoopConfig.reverse()
      }
    }

    if (routeID === 99 && stationName === 'Flinders Street') destination = 'City Loop'

    let message = ''

    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
    let mappedSuspensions = suspensions.map(e => adjustSuspension(e, trip, station.stopName))
    if (mappedSuspensions.length) {
      let firstSuspension = mappedSuspensions.find(suspension => suspension.disruptionStatus !== 'passed')
      if (firstSuspension) {
        message = `Buses replace trains from ${firstSuspension.startStation.slice(0, -16)} to ${firstSuspension.endStation.slice(0, -16)}`

        if (!isRailReplacementBus) {
          isRailReplacementBus = !!mappedSuspensions.find(suspension => suspension.disruptionStatus === 'current')
        }
      }
    }

    if (routeName === 'Stony Point') {
      let potentialConsist = await getStonyPoint(db)
      if (potentialConsist.length === 2) consist = potentialConsist
    }

    transformedDepartures.push({
      trip,
      scheduledDepartureTime,
      estimatedDepartureTime,
      actualDepartureTime,
      platform,
      isRailReplacementBus,
      cancelled, cityLoopConfig,
      destination, runID, vehicleType, runDestination,
      suspensions: mappedSuspensions,
      message,
      consist,
      willSkipLoop
    })
  }

  await async.forEach(trains, processDeparture)
  await async.forEachSeries(replacementBuses, processDeparture)

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
    console.log(e)
    try {
      let scheduled = await departureUtils.getScheduledMetroDepartures(station, db)
      return returnDepartures(scheduled)
    } catch (ee) {
      console.log(ee)
      return returnDepartures(null)
    }
  }
}

module.exports = getDepartures
