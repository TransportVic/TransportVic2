const TimedCache = require('../../TimedCache')
const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const moment = require('moment')
const departureUtils = require('../utils/get-train-timetables')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')

const getRouteStops = require('../../additional-data/route-stops')
const getStonyPoint = require('../get-stony-point')

const departuresCache = new TimedCache(1000 * 30)

let ptvAPILocks = {}

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

let burnleyGroup = [1, 2, 7, 9] // alamein, belgrave, glen waverley, lilydale
let caulfieldGroup = [4, 6, 11, 12] // cranbourne, frankston, pakenham, sandringham
let northernGroup = [3, 14, 15, 16, 17, 1482] // craigieburn, sunbury, upfield, werribee, williamstown, flemington racecourse
let cliftonHillGroup = [5, 8] // mernda, hurstbridge
let crossCityGroup = [6, 16, 17, 1482] // frankston, werribee, williamstown, flemington racecourse

function determineLoopRunning(routeID, runID, destination, isFormingNewTrip) {
  if (routeID === 13) return [] // stony point

  let upService = !(runID[3] % 2)
  let throughCityLoop = runID[1] > 5 || cityLoopStations.includes(destination) && destination !== 'Southern Cross'
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
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
        if (routeID === 99) cityLoopConfig.push('FSS')
    } else if (!stopsViaFlindersFirst && throughCityLoop) { // loop then flinders
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
      if (routeID === 99) cityLoopConfig = ['FSS', ...cityLoopConfig]
    } else if (stopsViaFlindersFirst && !throughCityLoop) { // direct to flinders
      if (caulfieldGroup.includes(routeID) && destination === 'Southern Cross')
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

async function getMissingRRB(station, db, individualRailBusDepartures) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let today = utils.now().startOf('day')
  let stopGTFSID = station.bays.find(bay => bay.mode === 'metro train').stopGTFSID

  let extraBuses = []

  await async.forEach(individualRailBusDepartures, async departureData => {
    let { departureTimeMinutes, origin, departureTime, destination, destinationArrivalTime, direction } = departureData
    let searchDays = departureTimeMinutes < 300 ? 1 : 0

    for (let i = 0; i <= searchDays; i++) {
      let day = today.clone().add(-i, 'days')

      let minutesPastMidnight = (departureTimeMinutes % 1440) + 1440 * i

      let extraBus = await gtfsTimetables.findDocument({
        operationDays: utils.getYYYYMMDD(day),
        mode: 'metro train',
        stopTimings: {
          $elemMatch: {
            stopGTFSID,
            departureTimeMinutes: minutesPastMidnight
          }
        },
        direction
      })

      if (extraBus) {
        if (extraBus.origin === origin && extraBus.destination === destination
          && extraBus.departureTime === departureTime
          && extraBus.destinationArrivalTime === destinationArrivalTime) return
        let stopData = extraBus.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
        let scheduledDepartureTime = utils.getMomentFromMinutesPastMidnight(stopData.departureTimeMinutes, day)

        extraBuses.push({
          trip: extraBus,
          scheduledDepartureTime,
          estimatedDepartureTime: null,
          actualDepartureTime: scheduledDepartureTime,
          platform: '-',
          scheduledDepartureTimeMinutes: stopData.departureTimeMinutes,
          cityLoopConfig: [],
          destination: extraBus.destination.slice(0, -16),
          runID: '',
          cancelled: false,
          suspensions: [],
          consist: [],
          isRailReplacementBus: true
        })
      }
    }
  })

  return extraBuses
}

async function findTrip(db, departure, scheduledDepartureTime, run, ptvRunID, route, station, replacementBusDepartures, suspensions) {
  let routeName = route.route_name
  let routeID = route.route_id
  let stationName = station.stopName.slice(0, -16)
  if (routeName.includes('Showgrounds')) routeName = 'Showgrounds/Flemington'
  let { stopGTFSID } = station.bays.find(bay => bay.mode === 'metro train')

  let runDestination = utils.adjustStopName(run.destination_name)
  let isRailReplacementBus = departure.flags.includes('RRB-RUN')

  let runID = ''
  if (!isRailReplacementBus && ptvRunID > 948000) {
    runID = utils.getRunID(ptvRunID)
  }

  let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

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

  let cityLoopConfig = !isRailReplacementBus ? determineLoopRunning(routeID, runID, runDestination, isFormingNewTrip) : []

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

    trip = await getStoppingPattern(db, ptvRunID, 'metro train', scheduledDepartureTime.toISOString())
    usedLive = true
  }

  return { trip, usedLive, runID, isRailReplacementBus, destination }
}

async function getDeparturesFromPTV(station, db, departuresCount, platform) {
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
    let service = text.match(/the (\d+:\d+[ap]m) ([ \w]*?) to ([ \w]*?) (?:train|service )?(?:will|has|is)/i)

    if (service) {
      let departureTime = service[1],
          origin = service[2],
          destination = service[3]

      let minutesPastMidnight = utils.getMinutesPastMidnightFromHHMM(departureTime.slice(0, -2))
      if (departureTime.includes('pm') && !departureTime.startsWith('12:')) minutesPastMidnight += 720

      return {
        departureTime: utils.getHHMMFromMinutesPastMidnight(minutesPastMidnight),
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

  let alterationMap = {}

  Object.values(disruptions).map(matchService).filter(Boolean).map(disruption => {
    let parts = disruption.originalText.match(/will (?:now )?(\w+) (?:from|at) (.*)./)
    if (parts) {
      let type = parts[1]
      let point = parts[2]

      let serviceID = `${disruption.origin}-${disruption.destination}-${disruption.departureTime}`
      alterationMap[serviceID] = true
      alterationMap[serviceID] = { type, point }
    }
  })

  let cityLoopSkipping = Object.values(disruptions).filter(disruption => {
    let description = disruption.description.toLowerCase()
    if (description.includes('maint') || description.includes('works') || disruption.disruption_type === 'Planned Works') return false

    return (description.includes('direct to') && description.includes('not via the city loop'))
     || (description.includes('city loop services') && description.includes('direct between flinders st'))
     || (description.match(/direct from [\w ]* to flinders st/) && description.includes('not via the city loop'))
  })

  let servicesSkippingLoop = []
  let linesSkippingLoop = []

  cityLoopSkipping.forEach(disruption => {
    let service = matchService(disruption)
    if (service) {
      servicesSkippingLoop.push(service)
    } else {
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

  let individualRailBusDepartures = []
  let railBusesSeen = []

  async function processRawDeparture(departure) {
    let ptvRunID = departure.run_ref
    let run = runs[ptvRunID]
    let routeID = departure.route_id
    let route = routes[routeID]
    let platform = departure.platform_number
    let suspensions = departure.disruption_ids.map(id => suspensionMap[id]).filter(Boolean)
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)
    let cancelled = run.status === 'cancelled'

    if (scheduledDepartureTime.diff(now, 'minutes') > 150) return

    let vehicleDescriptor = run.vehicle_descriptor || {}

    let vehicleType = vehicleDescriptor.description

    let consist = []

    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

    let tripData = await findTrip(db, departure, scheduledDepartureTime, run, ptvRunID, route, station, replacementBusDepartures, suspensions)
    if (!tripData) return
    let { trip, usedLive, runID, isRailReplacementBus, destination } = tripData

    if (isRailReplacementBus) {
      if (individualRailBusDepartures.some(bus => {
        return bus.origin === trip.origin && bus.destination === trip.destination
          && bus.departureTime === trip.departureTime
          && bus.destinationArrivalTime === trip.destinationArrivalTime
      })) return

      individualRailBusDepartures.push({
        departureTimeMinutes: scheduledDepartureTimeMinutes,
        direction: trip.direction,
        origin: trip.origin,
        departureTime: trip.departureTime,
        destination: trip.destination,
        destinationArrivalTime: trip.destinationArrivalTime,
      })
    }

    if (!usedLive) {
      let origin = trip.trueOrigin.slice(0, -16)
      let destination = trip.trueDestination.slice(0, -16)

      let serviceID = `${origin}-${destination}-${trip.trueDepartureTime}`
      if (alterationMap[serviceID]) trip = await getStoppingPattern(db, ptvRunID, 'metro train', scheduledDepartureTime.toISOString())
    }

    if (stonyPointReplacements.length) {
      let replacement = stonyPointReplacements.find(r => {
        return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime
      })
      if (replacement) isRailReplacementBus = true
    }

    if (routeID === 13 && !isRailReplacementBus) { // stony point platforms
      if (station.stopName === 'Frankston Railway Station') platform = '3'
      else platform = '1'
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

    if (trip.routeName === 'Stony Point') {
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
      destination, runID, vehicleType,
      suspensions: mappedSuspensions,
      message,
      consist,
      willSkipLoop
    })
  }

  await Promise.all([
    async.forEach(trains, processRawDeparture),
    async.forEachSeries(replacementBuses, processRawDeparture)
  ])

  return transformedDepartures.concat(await getMissingRRB(station, db, individualRailBusDepartures))
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
    return a.actualDepartureTime - b.actualDepartureTime || a.destination.localeCompare(b.destination)
  })
}

async function markRailBuses(departures, station, db) {
  let liveTimetables = db.getCollection('live timetables')
  let stopGTFSID = station.bays.find(bay => bay.mode === 'metro train').stopGTFSID

  await async.forEach(departures.filter(departure => departure.isRailReplacementBus), async departure => {
    let { trip } = departure
    let stopData = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
    let minutesDiff = stopData.departureTimeMinutes - trip.stopTimings[0].departureTimeMinutes
    let originDepartureTime = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

    let departureDay = utils.getYYYYMMDD(originDepartureTime)
    let windBackTime = trip.stopTimings[0].departureTimeMinutes > 1440
    let stopTimings = windBackTime ? trip.stopTimings.map(stop => {
      return {
        ...stop,
        departureTimeMinutes: stop.departureTimeMinutes - 1440
      }
    }) : trip.stopTimings

    let newTrip = {
      ...trip,
      stopTimings,
      isRailReplacementBus: true,
      operationDays: departureDay
    }

    let query = {
      departureTime: newTrip.departureTime,
      origin: newTrip.origin,
      destination: newTrip.destination,
      mode: 'metro train',
      operationDays: departureDay
    }

    delete newTrip._id

    await liveTimetables.replaceDocument(query, newTrip, {
      upsert: true
    })
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

    await markRailBuses(departures, station, db)

    departuresCache.put(cacheKey, Object.values(departures))
    return returnDepartures(filterDepartures(Object.values(departures), filter))
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
module.exports.findTrip = findTrip
