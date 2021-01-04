const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const departureUtils = require('../utils/get-train-timetables')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const fixTripDestination = require('./fix-trip-destinations')
const routeGTFSIDs = require('../../additional-data/metro-route-gtfs-ids')
const getRouteStops = require('../../additional-data/route-stops')
const getStonyPoint = require('../get-stony-point')
const metroConsists = require('../../additional-data/metro-tracker/metro-consists')

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
  let fssDirect = runID[1] <= 5

  let cityLoopConfig = []

  if (northernGroup.includes(routeID)) {
    if (destination === 'Southern Cross' && !throughCityLoop)
      cityLoopConfig = ['NME', 'SSS']
    else if (destination === 'Southern Cross' && throughCityLoop)
      cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
    else if (fssDirect && !throughCityLoop)
      cityLoopConfig = ['NME', 'SSS', 'FSS']
    else if (fssDirect && throughCityLoop)
      cityLoopConfig = ['SSS', 'FSS', 'PAR', 'MCE', 'FGS']
    else if (!fssDirect && throughCityLoop)
      cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
  } else {
    if (fssDirect && throughCityLoop) { // flinders then loop
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
        if (routeID === 99) cityLoopConfig.push('FSS')
    } else if (!fssDirect && throughCityLoop) { // loop then flinders
      if (burnleyGroup.concat(caulfieldGroup).concat(cliftonHillGroup).includes(routeID) || routeID === 99)
        cityLoopConfig = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
      if (routeID === 99) cityLoopConfig = ['FSS', ...cityLoopConfig]
    } else if (fssDirect && !throughCityLoop) { // direct to flinders
      if (caulfieldGroup.includes(routeID) && destination === 'Southern Cross')
        cityLoopConfig = ['RMD', 'FSS', 'SSS']
      else if (burnleyGroup.concat(caulfieldGroup).includes(routeID))
        cityLoopConfig = ['RMD', 'FSS']
      else if (cliftonHillGroup.includes(routeID))
        cityLoopConfig = ['JLI', 'FSS']
    }
  }


  if ((!upService || isFormingNewTrip) && destination !== 'Flagstaff') { // down trains away from city
    cityLoopConfig.reverse()
  }

  return cityLoopConfig
}

function mapSuspension(suspensionText, routeName) {
  let stationsAffected = suspensionText
    .replace(/\u00A0/g, ' ').replace(/[–-]/, ' and ')
    .match(/trains (?:between )?([ \w]+) and ([ \w]+) (?:stations|due)/i)

  if (!stationsAffected) return
  let startStation = utils.titleCase(stationsAffected[1].trim())
  let endStation = utils.titleCase(stationsAffected[2].trim())

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

function findConsist(consist, runID) {
  let finalConsist = []
  if (!consist) return null

  if (consist.toLowerCase().includes('hcmt')) {
    let parts = consist.match(/(\d+)/)
    let number
    if (parts) number = parts[1]
    if (number) {
      consist = '90' + utils.pad(number, 2, '0')
    }
  }

  if (consist.match(/train\d+/)) {
    // For now we don't know what this means so skip it
    return global.loggers.trackers.metro.warn('Encountered strange train', {
      consist,
      runID
    })
  }

  let carriages = consist.split('-')

  if (consist.includes('M')) {
    if (carriages.includes('313M') || carriages.includes('333M')) { // 313-333 withdrawn, replaced by 314-334
      let exclude = ['333M', '313M', '314M', '334M', '1007T', '1017T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1017T', ...carriages, '314M', '334M']
    }

    if (carriages.includes('330M') || carriages.includes('350M') || carriages.includes('691M') || carriages.includes('692M')) { // 691-692 withdrawn, replaced by 330-350
      let exclude = ['330M', '350M', '691M', '692M', '1025T', '1196T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1025T', ...carriages, '330M', '350M']
    }

    if (carriages.includes('527M') || carriages.includes('528M')) { // 695-696 withdrawn, replaced by 527-528
      let exclude = ['527M', '528M', '695M', '696M', '1114T', '1198T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1114T', ...carriages, '527M', '528M']
    }

    if (carriages.length <= 2) {
      finalConsist = metroConsists.filter(consist => carriages.some(carriage => consist.includes(carriage))).reduce((a, e) => {
        return a.concat(e)
      }, [])
    } else {
      let mCars = carriages.filter(carriage => carriage.endsWith('M'))
      let tCars = carriages.filter(carriage => carriage.endsWith('T'))
      let mCarNumbers = mCars.map(carriage => parseInt(carriage.slice(0, -1)))
      let anyPair = mCarNumbers.find(carriage => {
        // Only consider odd carriage as lower & find if it has + 1
        return (carriage % 2 === 1) && mCarNumbers.some(other => other == carriage + 1)
      })

      let mtmMatched
      if (anyPair) {
        mtmMatched = metroConsists.find(consist => consist.includes(anyPair + 'M'))
      } else {
        let consistFromTCars = tCars.map(tCar => metroConsists.find(consist => consist.includes(tCar)))
        mtmMatched = consistFromTCars.find(potentialConsist => {
          return mCars.includes(potentialConsist[0]) && mCars.includes(potentialConsist[2])
        })
      }

      if (mtmMatched) {
        finalConsist = finalConsist.concat(mtmMatched)

        let otherCars = carriages.filter(carriage => !mtmMatched.includes(carriage))
        let otherCarFull = metroConsists.find(consist => consist.includes(otherCars[0]))
        if (otherCarFull) {
          finalConsist = finalConsist.concat(otherCarFull)
        }
      } else {
        finalConsist = carriages
      }
    }
  } else if (carriages[0].match(/9\d{3}/)) {
    let setNumber = carriages[0].slice(-2)
    for (let i = 0; i <= 3; i++) finalConsist.push(`9${i}${setNumber}`)
    for (let i = 7; i <= 9; i++) finalConsist.push(`9${i}${setNumber}`)
  }

  if (finalConsist.length) {
    return finalConsist
  } else {
    return global.loggers.trackers.metro.warn('Encountered strange train', {
      consist,
      runID
    })
  }
}

async function saveConsists(db, transformedDepartures) {
  let metroTrips = db.getCollection('metro trips')
  await async.forEach(transformedDepartures, async departure => {
    if (departure.consist.length && departure.consistConfirmed && departure.trip.routeGTFSID !== '2-SPT') {
      let query = {
        date: departure.departureDay,
        runID: departure.runID
      }

      let tripData = {
        ...query,
        origin: departure.trip.trueOrigin.slice(0, -16),
        destination: departure.trip.trueDestination.slice(0, -16),
        departureTime: departure.trip.trueDepartureTime,
        destinationArrivalTime: departure.trip.trueDestinationArrivalTime,
        consist: departure.consist
      }

      await metroTrips.replaceDocument(query, tripData, {
        upsert: true
      })
    }
  })
}

async function getMissingRRB(station, db, individualRailBusDepartures) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let today = utils.now().startOf('day')
  let stopGTFSID = station.bays.find(bay => bay.mode === 'metro train').stopGTFSID

  let extraBuses = []

  await async.forEach(individualRailBusDepartures, async departureData => {
    let { departureTimeMinutes, origin, departureTime, destination, destinationArrivalTime, direction, routeGTFSID } = departureData
    let searchDays = departureTimeMinutes < 180 ? 1 : 0

    for (let i = 0; i <= searchDays; i++) {
      let day = today.clone().add(-i, 'days')

      let minutesPastMidnight = (departureTimeMinutes % 1440) + 1440 * i

      let potentialBuses = await gtfsTimetables.findDocuments({
        operationDays: utils.getYYYYMMDD(day),
        mode: 'metro train',
        stopTimings: {
          $elemMatch: {
            stopGTFSID,
            departureTimeMinutes: minutesPastMidnight
          }
        },
        direction,
        routeGTFSID
      }).sort({ destinationArrivalTime: 1 }).limit(3).toArray()

      potentialBuses.forEach(extraBus => {
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
      })
    }
  })

  return extraBuses
}

async function findTrip(db, departure, scheduledDepartureTime, run, ptvRunID, route, station, replacementBusDepartures, suspensions, individualRailBusDepartures) {
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
  if (caulfieldGroup.includes(routeID) && (destination === 'Southern Cross') || destination === 'Parliament')
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

  let isFormingNewTrip = cityLoopStations.includes(stationName) && destination !== 'Flinders Street' && destination !== 'Southern Cross'

  let isSCS = stationName === 'Southern Cross'
  let isFSS = stationName === 'Flinders Street'

  let cityLoopConfig = !isRailReplacementBus ? determineLoopRunning(routeID, runID, runDestination, isFormingNewTrip) : []

  if (isUpTrip && !cityLoopStations.includes(runDestination) &&
    !cityLoopStations.includes(stationName) && runDestination !== 'Flinders Street')
    cityLoopConfig = []

  if (cityLoopStations.includes(stationName) && !cityLoopConfig.includes('FGS')) {
    // we are in loop but given next trip - tdn decoding would give a direct service
    // really only seems to happen with cfd & nor group
    if (caulfieldGroup.includes(routeID) || burnleyGroup.includes(routeID))
      cityLoopConfig = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    else if (!crossCityGroup.includes(routeID) && northernGroup.includes(routeID)) {// all northern group except showgrounds & cross city
      if (runDestination !== 'Flinders Street')
        cityLoopConfig = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
    }
  }

  if (isUpTrip) {
    if (cityLoopStations.includes(stationName)) {
      if (cityLoopConfig[0] === 'FGS' && cityLoopConfig.slice(-1)[0] === 'SSS' && destination === 'Southern Cross')
        destination = 'Flinders Street'
    } else {
      if (cityLoopConfig[0] === 'FSS' || cityLoopConfig[1] === 'FSS')
        destination = 'Flinders Street'
      else if (['PAR', 'FGS'].includes(cityLoopConfig[0]) && !cityLoopStations.includes(stationName))
        destination = 'City Loop'
      else if (cityLoopConfig.slice(-1)[0] === 'SSS')
        destination = 'Southern Cross'
    }
  }

  if (routeName === 'Showgrounds/Flemington' && destination === 'Flagstaff') {
    destination = 'Flinders Street'
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
      if (isRailReplacementBus && suspensions.length === 0) {
        if (individualRailBusDepartures.some(b => b.departureTimeMinutes === scheduledDepartureTimeMinutes)) {
          return // ok this is risky but bus replacements actually seem to do it the same way as vline
        }
      }
    }

    trip = await getStoppingPattern(db, ptvRunID, 'metro train', scheduledDepartureTime.toISOString())
    usedLive = true
  }

  return { trip, usedLive, runID, isRailReplacementBus, destination, cityLoopConfig }
}

async function getDeparturesFromPTV(station, db, departuresCount, platform) {
  let metroNotify = db.getCollection('metro notify')
  let minutesPastMidnight = utils.getMinutesPastMidnightNow()
  let transformedDepartures = []

  let now = utils.now()

  let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
  let {stopGTFSID} = metroPlatform
  let stationName = station.stopName.slice(0, -16)

  let maxResults = 15
  if (stationName === 'Flinders Street' || cityLoopStations.includes(stationName)) maxResults = 10

  let {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/0/stop/${stopGTFSID}?gtfs=true&max_results=${maxResults}&include_cancelled=true&expand=run&expand=route&expand=VehicleDescriptor`)

  let disruptions = await metroNotify.findDocuments({
    toDate: {
      $gte: +new Date() / 1000
    },
    active: true
  }).toArray()

  let suspensionMap = {}
  disruptions.forEach(suspension => {
    if (suspension.type === 'suspended') {
      suspension.routeName.forEach(route => {
        if (!suspensionMap[route]) suspensionMap[route] = []
        let suspensionData = mapSuspension(suspension.text, route)
        if (suspensionData) suspensionMap[route].push(suspensionData)
      })
    }
  })

  if (suspensionMap.Frankston) {
    let possibleSty = suspensionMap.Frankston.find(s => s.stationB === 'Stony Point Railway Station')
    if (possibleSty && !suspensionMap['Stony Point']) suspensionMap['Stony Point'] = [possibleSty]
  }

  function matchService(disruption) {
    let text = disruption.text
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
        originalText: text,
        runID: disruption.runID
      }
    }
  }

  let stonyPointReplacements = disruptions.filter(disruption => {
    if (disruption.routeName.includes('Stony Point')) {
      return disruption.text.includes('replace')
    }
    return false
  }).map(matchService).filter(Boolean)

  let alterationMap = {}

  disruptions.map(matchService).filter(Boolean).map(disruption => {
    let parts = disruption.originalText.match(/will (?:now )?(\w+) (?:from|at) ([\w ]*?)(?: at.*?)?(?: [\d.:]*)?(?: today.*?)?(?: due.*?)?(?: and.*?)?.?/)
    if (parts) {
      let type = parts[1]
      let point = parts[2]

      alterationMap[disruption.runID] = { type, point }
    }
  })

  let nonWorks = disruptions.filter(disruption => {
    return disruption.type !== 'works'
  })

  let cityLoopSkipping = nonWorks.filter(disruption => {
    let description = disruption.text.toLowerCase()

    return (description.includes('direct to') && description.includes('not via the city loop'))
     || (description.includes('city loop services') && description.includes('direct between flinders st'))
     || ((description.match(/direct(?: from)? [\w ]* to flinders st/) || description.match(/direct(?: from)? flinders st/)) && description.includes('not via the city loop'))
     || description.includes('run direct to\/from flinders st')
     && !description.includes('resume') && !description.includes('select trains')
  })

  let altonaLoopSkipping = nonWorks.filter(disruption => {
    let description = disruption.text.toLowerCase()

    return description.includes('direct') && description.includes('not')
    && (description.includes('altona') || description.includes('westona') || description.includes('seaholme'))
    || description.includes('laverton to newport')
    || description.includes('newport to laverton')
  })

  let servicesSkippingALT = []
  let servicesSkippingCCL = []
  let linesSkippingCCL = []

  cityLoopSkipping.forEach(disruption => {
    let service = matchService(disruption)
    if (service) {
      servicesSkippingCCL.push(service)
    } else {
      linesSkippingCCL = linesSkippingCCL.concat(disruption.routeName.map(r => routeGTFSIDs[r]))
    }
  })

  altonaLoopSkipping.forEach(disruption => {
    let service = matchService(disruption)
    if (service) {
      servicesSkippingALT.push(service)
    } // Unsure of the suspension message
  })

  let replacementBuses = departures.filter(departure => departure.flags.includes('RRB-RUN')).sort((a, b) => {
    return utils.parseTime(a.scheduled_departure_utc) - utils.parseTime(b.scheduled_departure_utc)
  })

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
    let suspensions = suspensionMap[route.route_name] || []
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)
    let cancelled = run.status === 'cancelled'

    if (scheduledDepartureTime.diff(now, 'minutes') > 150) return

    let vehicleDescriptor = run.vehicle_descriptor || {}

    let vehicleType = vehicleDescriptor.description

    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

    let tripData = await findTrip(db, departure, scheduledDepartureTime, run, ptvRunID, route, station, replacementBusDepartures, suspensions, individualRailBusDepartures)
    if (!tripData) return
    let { trip, usedLive, runID, isRailReplacementBus, destination, cityLoopConfig } = tripData

    let consist = []
    let consistConfirmed = false

    let detectedConsist = findConsist(vehicleDescriptor.id, runID)
    if (detectedConsist && detectedConsist.length) {
      consist = detectedConsist
      consistConfirmed = true
    }

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
        routeGTFSID: trip.routeGTFSID
      })
    }

    let shortOrigin = trip.trueOrigin.slice(0, -16), shortDest = trip.trueDestination.slice(0, -16)
    let alteration = alterationMap[runID]
    if (alteration) {
      if (![shortOrigin, shortDest].includes(alteration.point)) {
        if (trip.type === 'timings') {
          await db.getCollection('live timetables').deleteDocument({
            _id: trip._id
          })
        }
        trip = await getStoppingPattern(db, ptvRunID, 'metro train', scheduledDepartureTime.toISOString())
      }
    }

    if (routeID === 13 && stonyPointReplacements.length) { // Only match STY if it *is* sty, there is a FKN up with the same timings
      let replacement = stonyPointReplacements.find(r => {
        return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime
      })
      if (replacement) isRailReplacementBus = true
    }

    if (routeID === 13 && !isRailReplacementBus) { // stony point platforms
      if (station.stopName === 'Frankston Railway Station') platform = '3'
      else platform = '1'
    }

    let willSkipCCL = servicesSkippingCCL.some(r => {
      return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime && r.destination === trip.destination.slice(0, -16)
    }) || linesSkippingCCL.includes(routes[routeID].route_gtfs_id)

    if (willSkipCCL) {
      if (cityLoopStations.includes(stationName)) {
        if (northernGroup.includes(routeID)) {
          if (stationName !== 'Southern Cross') return
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

    let willSkipALT = servicesSkippingALT.some(r => {
      return r.origin === trip.origin.slice(0, -16) && r.departureTime === trip.departureTime && r.destination === trip.destination.slice(0, -16)
    })

    let altLoopConfig = []
    if (trip.routeName === 'Werribee') {
      let stops = trip.stopTimings.map(stop => stop.stopName.slice(0, -16))
      let stopsNPTLAV = stops.includes('Newport') && stops.includes('Laverton')
      if (stopsNPTLAV) {
        if (stops.includes('Altona') && !willSkipALT) { // Via ALT Loop
          altLoopConfig = ['WTO', 'ALT', 'SHE']
        } else { // Via ML
          altLoopConfig = ['LAV', 'NPT']
        }

        if (trip.direction === 'Down') altLoopConfig.reverse()
      }
    }

    if (routeID === 99 && stationName === 'Flinders Street') destination = 'City Loop'

    let message = ''

    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
    let mappedSuspensions = suspensions.map(e => adjustSuspension(e, trip, station.stopName))
    if (mappedSuspensions.length && !isRailReplacementBus) {
      isRailReplacementBus = mappedSuspensions.some(suspension => suspension.disruptionStatus === 'current')
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
      cancelled,
      cityLoopConfig,
      altLoopConfig,
      destination, runID, vehicleType,
      suspensions: mappedSuspensions,
      message,
      consist,
      consistConfirmed,
      willSkipCCL,
      willSkipALT,
      routeID,
      ptvRunID
    })
  }

  await Promise.all([
    async.forEach(trains, processRawDeparture),
    async.forEachSeries(replacementBuses, processRawDeparture)
  ])

  let allDepartures = transformedDepartures.concat(await getMissingRRB(station, db, individualRailBusDepartures)).map(departure => {
    departure.departureDay = getDepartureDay(departure, stopGTFSID)
    return departure
  })

  await saveConsists(db, allDepartures)

  return allDepartures
}

function filterDepartures(departures, filter) {
  if (filter) {
    let now = utils.now()
    departures = departures.filter(departure => {
      let secondsDiff = departure.actualDepartureTime.diff(now, 'seconds')

      return -30 < secondsDiff && secondsDiff < 5400 // 1.5 hours
    })
  }

  return departures.sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime || a.destination.localeCompare(b.destination)
  })
}

async function updateSuspensions(departures, station, db) {
  let liveTimetables = db.getCollection('live timetables')
  let stationName = station.stopName.slice(0, -16)

  await async.forEach(departures.filter(departure => departure.suspensions.length), async departure => {
    let { trip } = departure
    let currentSuspension = departure.suspensions[0]

    let tripStops = trip.stopTimings.map(stop => stop.stopName)

    if (currentSuspension.disruptionStatus === 'before') { // Cut destination
      let startIndex = tripStops.indexOf(currentSuspension.startStation)
      if (startIndex == -1) startIndex = tripStops.length

      trip.stopTimings = trip.stopTimings.slice(0, startIndex + 1)
    } else if (currentSuspension.disruptionStatus === 'current') { // Rail bus
      let startIndex = tripStops.indexOf(currentSuspension.startStation)
      let endIndex = tripStops.indexOf(currentSuspension.endStation)

      if (startIndex == -1) startIndex = 0
      if (endIndex == -1) endIndex = tripStops.length

      trip.stopTimings = trip.stopTimings.slice(startIndex, endIndex + 1)

      departure.cancelled = false
      trip.cancelled = false
      departure.estimatedDepartureTime = null
      departure.actualDepartureTime = departure.scheduledDepartureTime
    } else if (currentSuspension.disruptionStatus === 'passed') { // Cut origin
      let endIndex = tripStops.indexOf(currentSuspension.endStation)
      if (endIndex == -1) endIndex = 0

      trip.stopTimings = trip.stopTimings.slice(endIndex)
    }

    let firstStop = trip.stopTimings[0]
    let lastStop = trip.stopTimings.slice(-1)[0]

    firstStop.arrivalTime = null
    firstStop.arrivalTimeMinutes = null
    lastStop.departureTime = null
    lastStop.departureTimeMinutes = null

    trip.originalDestination = trip.destination

    trip.origin = firstStop.stopName
    trip.destination = lastStop.stopName
    trip.departureTime = firstStop.departureTime
    trip.destinationArrivalTime = lastStop.arrivalTime

    trip.affectedBySuspension = true

    trip = fixTripDestination(trip)

    departure.destination = trip.trueDestination.slice(0, -16)

    if (trip.direction === 'Up' && !cityLoopStations.includes(stationName) && currentSuspension.disruptionStatus !== 'current') {
      let cityLoopConfig = determineLoopRunning(departure.routeID, departure.runID, departure.destination, false)
      if (departure.destination !== 'Flinders Street')
        cityLoopConfig = []

      if (cityLoopConfig[0] === 'FSS' || cityLoopConfig[1] === 'FSS')
        departure.destination = 'Flinders Street'
      else if (['PAR', 'FGS'].includes(cityLoopConfig[0]) && !cityLoopStations.includes(stationName))
        departure.destination = 'City Loop'
      else if (cityLoopConfig.slice(-1)[0] === 'SSS')
        departure.destination = 'Southern Cross'
    }
  })
}

function getDepartureDay(departure, stopGTFSID) {
  let { trip } = departure
  let stopData = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
  if (!stopData) return

  let minutesDiff = stopData.departureTimeMinutes - trip.stopTimings[0].departureTimeMinutes
  let originDepartureTime = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

  return utils.getYYYYMMDD(originDepartureTime)
}

async function markRailBuses(departures, station, db) {
  let liveTimetables = db.getCollection('live timetables')
  let stopGTFSID = station.bays.find(bay => bay.mode === 'metro train').stopGTFSID

  await async.forEachSeries(departures.filter(departure => departure.suspensions.length && departure.isRailReplacementBus), async departure => {
    if (departure.runID) {
      let runIDQuery = {
        mode: 'metro train',
        operationDays: departure.departureDay,
        runID: departure.runID
      }

      await liveTimetables.deleteDocuments(runIDQuery)
    }
  })

  await async.forEachSeries(departures.filter(departure => departure.suspensions.length || departure.isRailReplacementBus || departure.trip.isRailReplacementBus), async departure => {
    let { trip } = departure
    let departureDay = departure.departureDay

    let windBackTime = trip.stopTimings[0].departureTimeMinutes > 1440
    let stopTimings = (windBackTime ? trip.stopTimings.map(stop => {
      return {
        ...stop,
        arrivalTimeMinutes: stop.arrivalTimeMinutes ? stop.arrivalTimeMinutes - 1440 : null,
        departureTimeMinutes: stop.departureTimeMinutes ? stop.departureTimeMinutes - 1440 : null
      }
    }) : trip.stopTimings).map(stop => {
      let estimatedDepartureTime = departure.estimatedDepartureTime ? departure.estimatedDepartureTime.toISOString() : null
      return {
        ...stop,
        estimatedDepartureTime: departure.isRailReplacementBus ? null : estimatedDepartureTime,
        platform: departure.isRailReplacementBus ? null : stop.platform
      }
    })

    let newTrip = {
      ...trip,
      stopTimings,
      isRailReplacementBus: departure.isRailReplacementBus,
      operationDays: departureDay
    }
    delete newTrip._id

    let query = {
      trueDepartureTime: newTrip.trueDepartureTime,
      trueDestinationArrivalTime: newTrip.trueDestinationArrivalTime,
      trueOrigin: newTrip.trueOrigin,
      trueDestination: newTrip.trueDestination,
      mode: 'metro train',
      operationDays: departureDay
    }

    let runIDQuery = {
      mode: 'metro train',
      operationDays: departureDay,
      runID: departure.runID
    }

    if (departure.isRailReplacementBus) {
      delete newTrip.vehicle
      delete newTrip.runID
    }

    if (await liveTimetables.countDocuments(runIDQuery)) {
      if (await liveTimetables.countDocuments(query)) return

      await liveTimetables.replaceDocument(runIDQuery, newTrip)
    } else {
      await liveTimetables.replaceDocument(query, newTrip, {
        upsert: true
      })
    }
  })
}

async function getDepartures(station, db, filter=true) {
  try {
    return await utils.getData('metro-departures', station.stopName, async () => {
      let departures = await getDeparturesFromPTV(station, db)

      await updateSuspensions(departures, station, db)
      await markRailBuses(departures, station, db)

      return filterDepartures(departures, filter)
    })
  } catch (e) {
    global.loggers.general.err('Error getting Metro departures', e)
    try {
      return await departureUtils.getScheduledMetroDepartures(station, db)
    } catch (ee) {
      global.loggers.general.err('Error getting Scheduled Metro departures', ee)
      return null
    }
  }
}

module.exports = getDepartures
module.exports.findTrip = findTrip
