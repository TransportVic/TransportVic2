import async from 'async'
import urls from '../../../../urls.json' with { type: 'json' }
import utils from '../../../../utils.mjs'
import cheerio from 'cheerio'
import termini from '../../../../additional-data/termini-to-lines.js'
import getMetroDepartures from '../../../../modules/metro-trains/get-departures.mjs'
import getVLineStops from './SSS-Lines.mjs'
import getMetroStops from '../../../../additional-data/route-stops.mjs'
import TrainUtils from '../TrainUtils.mjs'
import { getDayOfWeek } from '../../../../public-holidays.mjs'

const emptyCars = []

let northernGroup = [
  'Craigieburn',
  'Sunbury',
  'Upfield',
  'Werribee',
  'Williamstown',
  'Showgrounds/Flemington'
]

let crossCityGroup = [
  'Werribee',
  'Williamstown',
  'Frankston'
]

let gippslandLines = [
  'Bairnsdale',
  'Traralgon'
]

let cliftonHillGroup = [
  'Hurstbridge',
  'Mernda'
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getStationFromVNETName(vnetStationName, db) {
  const station = await db.getCollection('stops').findDocument({
    bays: {
      $elemMatch: {
        mode: 'regional train',
        vnetStationName
      }
    }
  })

  return station
}

function getShortRouteName(trip) {
  let origin = trip.origin.slice(0, -16)
  let destination = trip.destination.slice(0, -16)
  let originDest = `${origin}-${destination}`

  return termini[originDest] || termini[origin] || termini[destination]
}

async function getVNETServices(vlinePlatform, isDepartures, db) {
  const {vnetStationName} = vlinePlatform

  let vnetURL
  if (isDepartures)
    vnetURL = urls.vlinePlatformDeparturesOld.slice(0, -3).format(vnetStationName, 'D') + '1440'
  else
    vnetURL = urls.vlinePlatformArrivalsOld.slice(0, -3).format(vnetStationName, 'U') + '1440'

  const body = (await utils.request(vnetURL)).replace(/a:/g, '')
  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  let mappedDepartures = []

  await async.forEach(allServices, async service => {
    let estimatedDepartureTime

    function $$(q) {
      return $(q, service)
    }

    if (!isNaN(new Date($$('ActualArrivalTime').text()))) {
      estimatedDepartureTime = utils.parseTime($$('ActualArrivalTime').text())
    } // yes arrival cos vnet

    let platform = $$('Platform').text()
    let originDepartureTime = utils.parseTime($$('ScheduledDepartureTime').text())
    let destinationArrivalTime = utils.parseTime($$('ScheduledDestinationArrivalTime').text())
    let runID = $$('ServiceIdentifier').text()
    let originVNETName = $$('Origin').text()
    let destinationVNETName = $$('Destination').text()

    let accessibleTrain = $$('IsAccessibleAvailable') === 'true'
    let cateringAvailable = $$('IsBuffetAvailable') === 'true'

    let vehicle = $$('Consist').text().replace(/ /g, '-')
    const vehicleConsist = $$('ConsistVehicles').text().replace(/ /g, '-')
    let fullVehicle = vehicle
    let vehicleType

    if (vehicle.startsWith('N')) {
      let carriages = vehicleConsist.slice(5).split('-')
      fullVehicle = vehicleConsist

      vehicleType = 'N +'
      vehicleType += carriages.length

      if (carriages.includes('N')) vehicleType += 'N'
      else vehicleType += 'H'
    } else if (vehicle.includes('VL')) {
      let cars = vehicle.split('-')
      fullVehicle = vehicle.replace(/\dVL/g, 'VL')

      vehicleType = cars.length + 'x 3VL'
    } else if (vehicle.match(/70\d\d/)) {
      let cars = vehicle.split('-')
      vehicleType = cars.length + 'x SP'
    }

    if ($$('Consist').attr('i:nil'))
      fullVehicle = ''

    let direction = $$('Direction').text()
    if (direction === 'D') direction = 'Down'
    else direction = 'Up'

    const originStation = await getStationFromVNETName(originVNETName, db)
    const destinationStation = await getStationFromVNETName(destinationVNETName, db)

    let originVLinePlatform = originStation.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)
    let destinationVLinePlatform = destinationStation.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)

    mappedDepartures.push({
      runID,
      originVNETName: originVLinePlatform.vnetStationName,
      destinationVNETName: destinationVLinePlatform.vnetStationName,
      origin: originVLinePlatform.fullStopName,
      destination: destinationVLinePlatform.fullStopName,
      originDepartureTime, destinationArrivalTime,
      platform, estimatedDepartureTime,
      direction,
      vehicle: fullVehicle,
      cateringAvailable,
      accessibleTrain,
      vehicleType
    })
  })

  return mappedDepartures
}

async function getServicesFromVNET(vlinePlatform, isDepartures, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')

  let vnetServices = await getVNETServices(vlinePlatform, isDepartures, db)

  let journeyCache = {}
  let stopGTFSID = vlinePlatform.stopGTFSID

  let departures = await async.map(vnetServices, async departure => {
    let dayOfWeek = await getDayOfWeek(departure.originDepartureTime)
    let operationDay = departure.originDepartureTime.format('YYYYMMDD')

    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let trip
    let departureTime = departure.originDepartureTime
    let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)

    for (let i = 0; i <= 1; i++) {
      let tripDay = departureTime.clone().add(-i, 'days')
      let query = {
        operationDays: utils.getYYYYMMDD(tripDay),
        mode: 'regional train',
        stopTimings: {
          $elemMatch: {
            stopGTFSID,
            departureTimeMinutes: scheduledDepartureTimeMinutes + 1440 * i
          }
        },
        destination: departure.destination
      }

      // improve this
      trip = await liveTimetables.findDocument(query)
      if (trip) break
      trip = await gtfsTimetables.findDocument(query)
      if (trip) break
    }

    if (!trip && nspTrip) trip = nspTrip

    if (!trip) {
      console.log(departure)
    }

    let platform = departure.platform

    if (trip.destination !== departure.destination) {
      let stoppingAt = trip.stopTimings.map(e => e.stopName)
      let destinationIndex = stoppingAt.indexOf(departure.destination)
      trip.stopTimings = trip.stopTimings.slice(0, destinationIndex + 1)
      let lastStop = trip.stopTimings[destinationIndex]

      if (lastStop) { // trip extensions and all...
        trip.destination = lastStop.stopName
        trip.destinationArrivalTime = lastStop.arrivalTime
        lastStop.departureTime = null
        lastStop.departureTimeMinutes = null

        trip.runID = departure.runID
        trip.operationDays = operationDay

        // delete trip._id
        // await liveTimetables.replaceDocument({
        //   operationDays: operationDay,
        //   runID: departure.runID,
        //   mode: 'regional train'
        // }, trip, {
        //   upsert: true
        // })
      }
    }

    trip.vehicleType = departure.vehicleType
    trip.vehicle = departure.vehicle

    return {
      type: 'vline',
      shortRouteName: getShortRouteName(trip),
      trip,
      platform,
      scheduledDepartureTime: departure.originDepartureTime,
      destinationArrivalTime: departure.destinationArrivalTime,
      estimatedDepartureTime: departure.estimatedDepartureTime,
      actualDepartureTime: departure.originDepartureTime,
      runID: departure.runID,
      vehicle: departure.vehicle,
      origin: trip.origin.slice(0, -16),
      destination: trip.destination.slice(0, -16),
      flags: {
        cateringAvailable: departure.cateringAvailable,
        accessibleTrain: departure.accessibleTrain
      },
      tripFlags: nspTrip ? nspTrip.flags : {},
      connections: []
    }
  })

  return departures
}

function filterPlatforms(services, platforms) {
  return services.filter(departure => {
    if (departure.type === 'vline') {
      if (!departure.platform) return null
      let mainPlatform = departure.platform.replace(/[A-Z]/, '')

      return platforms.includes(mainPlatform)
    } else {
      return platforms.includes(departure.platform)
    }
  })
}

async function getScheduledArrivals(knownArrivals, db) {
  let timetables = db.getCollection('timetables')
  let today = utils.getPTDayName(utils.now())
  let minutesPastMidnight = utils.getMinutesPastMidnightNow()

  let arrivals = await timetables.findDocuments({
    operationDays: today,
    mode: 'regional train',
    direction: 'Up',
    runID: {
      $not: {
        $in: knownArrivals
      }
    },
    stopTimings: {
      $elemMatch: {
        stopName: 'Southern Cross Railway Station',
        arrivalTimeMinutes: {
          $gt: minutesPastMidnight
        }
      }
    }
  }).toArray()

  return arrivals.map(a => {
    let platform = a.stopTimings.slice(-1)[0].platform
    let {arrivalTimeMinutes} = a.stopTimings.slice(-1)[0]
    let arrivalTime = utils.getMomentFromMinutesPastMidnight(arrivalTimeMinutes, utils.now())

    return {
      type: 'vline',
      scheduled: true,
      shortRouteName: a.shortRouteName,
      trip: a,
      platform,
      destinationArrivalTime: arrivalTime,
      estimatedDepartureTime: null,
      runID: a.runID,
      vehicle: null,
      origin: a.origin.slice(0, -16),
      destination: a.destination.slice(0, -16)
    }
  })
}

function shortenExpressName(name) {
  if (name === 'North Melbourne') return 'Nth Melbourne'
  if (name === 'South Kensington') return 'S Kensington'
  if (name === 'North Williamstown') return 'N Williamstwn'
  if (name === 'Williamstown Beach') return 'Wilmstwn Bch'
  if (name === 'South Kensington') return 'S Kensington'
  if (name === 'Roal Park') return 'Royal Pk'
  if (name.includes('Flemington')) return name.replace('Flemington', 'Flemtn')
  return name
}

function shortenStopName(name) {
  if (name === 'South Kensington') return 'S Kensington'
  if (name === 'North Williamstown') return 'N Williamstwn'
  if (name === 'Williamstown Beach') return 'Wilmstwn Bch'
  if (name === 'South Kensington') return 'S Kensington'
  if (name.includes('Flemington')) return name.replace('Flemington', 'Flemtn')
  return name
}

function getStoppingPattern(routeName, stopsAt, isUp, type) {
  if (routeName === 'Bendigo') {
    if (!isUp && stopsAt.slice(-1)[0] === 'Eaglehawk') routeName = 'Swan Hill'
  }

  let lineStops
  if (type === 'metro')
    lineStops = getMetroStops(routeName)
  else
    lineStops = getVLineStops(routeName)

  if (isUp) lineStops = lineStops.slice(0).reverse()

  lineStops = TrainUtils.getFixedLineStops(stopsAt, lineStops, routeName, isUp, type)
  let expresses = TrainUtils.findExpressStops(stopsAt, lineStops, routeName, isUp, 'Southern Cross')

  if (expresses.length === 0) return 'STOPPING ALL STATIONS'
  if (expresses.length === 1 && expresses[0].length === 1)
    return `NOT STOPPING AT ${shortenExpressName(expresses[0][0]).toUpperCase()}`
  let firstExpress = expresses[0]
  let firstExpressStop = firstExpress[0], lastExpressStop = firstExpress.slice(-1)[0]

  let previousStop = shortenExpressName(lineStops[lineStops.indexOf(firstExpressStop) - 1])
  let nextStop = shortenExpressName(lineStops[lineStops.indexOf(lastExpressStop) + 1])

  return `EXPRESS ${previousStop.toUpperCase()} -- ${nextStop.toUpperCase()}`
}

async function appendMetroData(departure, timetables) {
  let {runID} = departure
  let today = utils.getPTDayName(utils.now())

  let scheduled = await timetables.findDocument({
    runID, operationDays: today
  })

  let connections = []

  if (scheduled) connections = scheduled.connections

  let stopTimings = departure.trip.stopTimings.slice(0).map(e => e.stopName.slice(0, -16))
  let routeName = departure.trip.routeName
  let isUp = departure.trip.direction === 'Up'

  let sssIndex = stopTimings.lastIndexOf('Southern Cross')
  let trimmedTimings = stopTimings.slice(sssIndex)

  let via = []
  trimmedTimings.slice(0, 6).forEach(stop => {
    if (via.length === 2) return

    if (stop === 'Flinders Street') {
      via.push('Flinders St')
    } else if (stop === 'Flagstaff') {
      via.push('City Loop')
    }
    if (stop === 'North Melbourne') {
      via.push('Nth Melbourne')
    } else if (stop === 'Richmond') {
      via.push('Richmond')
    }
  })

  let message = []

  let viaText = `VIA ${via[0].toUpperCase()}`
  if (via[1]) viaText += ` AND ${via[1].toUpperCase()}`

  if (departure.destination === 'North Melbourne') viaText = 'VIA NTH MELBOURNE TO NTH MELBOURNE'
  if (departure.destination === 'Flinders Street') viaText = 'DIRECT, STOPPING ALL STATIONS'

  departure.viaText = viaText
  departure.connections = connections || []

  departure.sssStoppingPattern = getStoppingPattern(routeName, trimmedTimings, isUp, 'metro')

  return departure
}

function breakup(text) {
  let broken = ['', '']
  let wordCount = 0

  text.split(' ').forEach(word => {
    wordCount += word.length
    if (wordCount > 20) {
      broken[1] += ` ${word}`
    } else {
      broken[0] += ` ${word}`
    }
  })

  return broken
}

async function appendVLineData(departure, timetables) {
  let {runID} = departure
  let today = utils.getPTDayName(utils.now())

  let stopTimings = departure.trip.stopTimings.map(e => e.stopName.slice(0, -16))
  let routeName = departure.shortRouteName
  let isUp = false

  let {destination} = departure

  let viaStops = []
  if (destination === 'South Geelong') viaStops = ['Deer Park', 'Tarneit', 'Wyndham Vale']
  if (destination === 'Geelong') viaStops = ['Deer Park', 'Tarneit']
  if (destination === 'Marshall') viaStops = ['Tarneit', 'Wyndham Vale']
  if (destination === 'Epsom') viaStops = ['Bendigo']
  if (destination === 'Melton') viaStops = ['Deer Park', 'Caroline Springs']
  if (destination === 'Wyndham Vale') viaStops = ['Deer Park', 'Tarneit']
  if (destination === 'Waurn Ponds') viaStops = ['Deer Park', 'Tarneit', 'Wyndham Vale']
  if (destination === 'Wendouree') viaStops = ['Ballarat']
  if (destination === 'Shepparton') viaStops = ['Seymour']

  let via = stopTimings.filter(s => viaStops.includes(s)).map(e => e.toUpperCase())
  let viaStopsText, viaText = ''
  if (via.length > 0) {
    if (via.length === 1) viaStopsText = via[0]
    else if (via.length === 2) viaStopsText = `${via[0]} & ${via[1]}`
    else {
      let initial = via.slice(0, -1).join(' - ')
      let last = via.slice(-1)[0]
      viaStopsText = `${initial} & ${last}`
    }
    viaText = `via ${viaStopsText}`
  }

  let brokenVia = breakup(viaText)

  let tripDivideTypes = {
    'Bacchus Marsh': 'FRONT',
    'Bendigo': 'FRONT',
    'Ballarat': 'REAR', // maryborough, ararat
    'Traralgon': 'REAR', // Sale
    'Geelong': 'REAR' // from WPD, front 3 DV to Depot. Doesn't show here but just recording it anyway
  }

  if (departure.tripFlags.tripDivides) {
    let type = tripDivideTypes[departure.tripFlags.tripDividePoint]
    let remainingStops = stopTimings.slice(stopTimings.indexOf(departure.tripFlags.tripDividePoint) + 1)

    let stopsList = `${remainingStops.slice(0, -1).join(' ')} or ${remainingStops.slice(-1)[0]}`
    if (remainingStops.length === 1) stopsList = remainingStops[0]

    departure.divideInfo = {
      first: `${type} 3 carriages for ${stopsList}`,
      next: breakup(`${stopsList} ${type} 3 carriages`)
    }
  }

  departure.viaText = viaText
  departure.brokenVia = brokenVia

  departure.sssStoppingPattern = getStoppingPattern(routeName, stopTimings, isUp, 'vline')

  return departure
}

async function appendArrivalData(arrival, timetables) {
  let {runID} = arrival
  let dayOfWeek = await getDayOfWeek(arrival.destinationArrivalTime)
  let operationDay = arrival.destinationArrivalTime.format('YYYYMMDD')

  let nspTrip = await timetables.findDocument({
    operationDays: dayOfWeek,
    runID,
    mode: 'regional train'
  })

  if (!nspTrip) {
    console.log(`Failed to find NSP trip for ${runID}`)
    return arrival
  }
  let formingID = nspTrip.forming

  if (formingID === 'OFF') {
    arrival.showDeparture = 'OFF'
  } else {
    if (dayOfWeek === 'Tues') dayOfWeek = 'TUE'
    if (dayOfWeek === 'Thur') dayOfWeek = 'THU'

    let forming = emptyCars.find(trip => {
      return formingID.includes(trip.runID) && trip.days.includes(dayOfWeek.toUpperCase())
    })

    if (forming) { // only consider empty car movements
      arrival.showDeparture = 'OFF'
      let departureTime = forming.tripTimings[0].departureTime
      let minutesPastMidnight = utils.getMinutesPastMidnightFromHHMM(departureTime)
      arrival.formingID = forming.runID
      arrival.formingDepartureTime = utils.getMomentFromMinutesPastMidnight(minutesPastMidnight, utils.now())
    }
  }
  return arrival
}

export default async (platforms, db) => {
  let rawData = await utils.getData('sss-trains', 'sss', async () => {
    let sss = await db.getCollection('stops').findDocument({
      cleanName: 'southern-cross-railway-station'
    })

    let vlinePlatform = sss.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)
    let metroPlatform = sss.bays.find(bay => bay.mode === 'metro train')

    let timetables = db.getCollection('timetables')

    let departures = await async.map(await getServicesFromVNET(vlinePlatform, true, db), async d => {
      return await appendVLineData(d, timetables)
    })

    let arrivals = await getServicesFromVNET(vlinePlatform, false, db)
    let knownArrivals = arrivals.map(a => a.runID)

    let scheduledArrivals = await getScheduledArrivals(knownArrivals, db)

    let mtmDepartures = (await async.map(await getMetroDepartures(sss, db, false), async d => {
      return await appendMetroData(d, timetables)
    })).filter(e => !e.isRailReplacementBus && !e.cancelled)

    let formingIDsSeen = []
    let allArrivals = (await async.map(arrivals.concat(scheduledArrivals).sort((a, b) => a.destinationArrivalTime - b.destinationArrivalTime), async d => {
      return await appendArrivalData(d, timetables)
    })).filter(arrival => {
      if (!arrival.formingID) return true
      if (formingIDsSeen.includes(arrival.formingID)) return false
      formingIDsSeen.push(arrival.formingID)
      return true
    })
    let allDepartures = departures.concat(mtmDepartures).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)

    return { departures: allDepartures, arrivals: allArrivals }
  }, 1000 * 60 * 1.5)

  return { departures: filterPlatforms(rawData.departures, platforms), arrivals: filterPlatforms(rawData.arrivals, platforms) }
}