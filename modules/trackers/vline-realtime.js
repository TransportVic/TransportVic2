const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const moment = require('moment')
const DatabaseConnection = require('../../database/DatabaseConnection')
const findTrip = require('../vline/find-trip')
const getVNETDepartures = require('../vline/get-vnet-departures')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let refreshRate = 12

let stops = [
  'North Geelong',
  'Tarneit',
  'Footscray',
  'Marshall',
  'Rockbank',
  'Melton',
  'Ballarat',
  'Kangaroo Flat',
  'Woodend',
  'Sunbury',
  'Caulfield',
  'Warragul',
  'Morwell',
  'Sale',
  'Flinders Street',
  'Broadmeadows',
  'Heathcote Junction',
  'Tallarook',
  'Mooroopna',
  'Rochester',
  'Pyramid',
  'Terang',
]

function shouldRun() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 210 <= minutes && minutes <= 1380 // 0330 - 2300
}

async function getDeparturesFromVNET(db, station) {
  let vnetName = station.bays.find(bay => bay.vnetStationName).vnetStationName

  let down = [], up = []
  try {
    down = await getVNETDepartures(vnetName, 'D', db, 1440, true)
  } catch (e) {}
  try {
    up = await getVNETDepartures(vnetName, 'U', db, 1440, true)
  } catch (e) {}

  let vnetDepartures = [ ...down, ...up ]

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  return (await async.map(vnetDepartures, async departure => {
    let departureDay = utils.getYYYYMMDD(departure.originDepartureTime)
    let departureTimeHHMM = utils.formatHHMM(departure.originDepartureTime)

    let departureMinutes = utils.getMinutesPastMidnight(departure.originDepartureTime)
    if (departureTimeMinutes < 300) departureDay = utils.getYYYYMMDD(departure.originDepartureTime.clone().add(-1, 'day'))

    let trip = (await liveTimetables.findDocument({
      operationDays: departureDay,
      runID: departure.runID,
      mode: 'regional train'
    })) || await findTrip(gtfsTimetables, departureDay, departure.origin, departure.destination, departureTimeHHMM)

    departure.trip = trip

    if (trip) {
      let stopTiming = trip.stopTimings.find(stop => stop.stopName === station.stopName)
      let originTiming = trip.stopTimings.find(stop => stop.stopName === departure.origin)

      let minutesDifference = (stopTiming.arrivalTimeMinutes || stopTiming.departureTimeMinutes) - originTiming.departureTimeMinutes

      let scheduledDepartureTime = departure.originDepartureTime.clone().add(minutesDifference, 'minutes')
      let estimatedArrivalTime = departure.estimatedStopArrivalTime

      let delay = estimatedArrivalTime - scheduledDepartureTime
      departure.delay = delay
      departure.stopTiming = stopTiming

      trip.runID = departure.runID
      trip.operationDays = departureDay
      delete trip._id
    }

    return departure
  })).filter(departure => departure.trip)
}


async function fetchData() {
  let dbStops = await database.getCollection('stops')
  let liveTimetables = await database.getCollection('live timetables')

  let trips = {}
  let tripDepartureTimes = {}
  let combinedTripData = {}

  await async.forEachSeries(stops, async stop => {
    let stopData = await dbStops.findDocument({ stopName: stop + ' Railway Station' })
    let departures = await getDeparturesFromVNET(database, stopData)
    departures.forEach(departure => {
      let {runID} = departure
      if (!combinedTripData[runID]) {
        combinedTripData[runID] = {}
        trips[runID] = departure.trip
        tripDepartureTimes[runID] = {
          moment: departure.originDepartureTime,
          minutes: departure.trip.stopTimings.find(stop => stop.stopName === departure.origin).departureTimeMinutes
        }
      }

      let {stopTiming, delay} = departure
      combinedTripData[runID][stopTiming.stopName] = delay

      let destinationTiming = departure.trip.stopTimings.find(stop => stop.stopName === departure.destination)
      combinedTripData[runID][destinationTiming.stopName] = departure.estimatedDestArrivalTime - departure.destinationArrivalTime
    })

    await utils.sleep(3000)
  })

  await async.forEach(Object.keys(combinedTripData), async runID => {
    let stopDelays = combinedTripData[runID]
    let trip = trips[runID]

    let tripStops = trip.stopTimings.map(stop => stop.stopName)
    let orderedStops = Object.keys(stopDelays).map(stop => [stop, tripStops.indexOf(stop)])
      .sort((a, b) => a[1] - b[1]).map(stop => stop[0])

    let tripDepartureTime = tripDepartureTimes[runID]

    orderedStops.forEach((stop, i) => {
      if (i === 0) return
      let previous = orderedStops[i - 1]

      let currentDelay = stopDelays[stop]
      let previousDelay = stopDelays[previous]

      let delayDifference = currentDelay - previousDelay

      let previousIndex = tripStops.indexOf(previous)
      let currentIndex = tripStops.indexOf(stop)
      let relevantStops = trip.stopTimings.slice(previousIndex, currentIndex + 1)

      let previousMinutes = trip.stopTimings[previousIndex].departureTimeMinutes
      let currentStopData = trip.stopTimings[currentIndex]
      let currentMinutes = (currentStopData.departureTimeMinutes || currentStopData.arrivalTimeMinutes)

      let minutesDifference = currentMinutes - previousMinutes

      relevantStops.forEach(stop => {
        let stopMinutes = (stop.departureTimeMinutes || stop.arrivalTimeMinutes)
        let minutesFromPrevious = stopMinutes - previousMinutes
        let minutesPercentage = minutesFromPrevious / minutesDifference
        let delayPercentage = minutesPercentage * delayDifference

        let minutesFromOrigin = stopMinutes - tripDepartureTime.minutes
        let scheduledDepartureTime = tripDepartureTime.moment.clone().add(minutesFromOrigin, 'minutes')
        let estimatedDepartureTime = scheduledDepartureTime.clone().add(previousDelay + delayPercentage, 'milliseconds')

        stop.estimatedDepartureTime = estimatedDepartureTime.toISOString()
        stop.actualDepartureTimeMS = +estimatedDepartureTime
      })
    })

    await liveTimetables.replaceDocument({
      operationDays: trip.operationDays,
      runID: trip.runID,
      mode: 'regional train'
    }, trip, {
      upsert: true
    })
  })
}

async function requestTimings() {
  console.log('requesting vline realtime data')
  try {
    await fetchData()
  } catch (e) {
    console.error(e)
    console.log('Error getting vline realtime data, skipping this round')
  }

  if (shouldRun()) {
    setTimeout(requestTimings, refreshRate * 60 * 1000)
  } else {
    let minutesPastMidnight = utils.getMinutesPastMidnightNow()
    let timeToStart = (1440 + refreshRate * 60 * 1000 - minutesPastMidnight) % 1440

    setTimeout(requestTimings, timeToStart * 60 * 1000)
  }
}

database.connect(async () => {
  await requestTimings()
})
