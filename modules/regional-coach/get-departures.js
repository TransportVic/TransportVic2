const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 5 })
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const destinationOverrides = require('../../additional-data/coach-destinations')
const EventEmitter = require('events')

let ptvAPILocks = {}

let vlineTrainRoutes = [
  '1-Ech',
  '1-my1',
  '1-Sht',
  '1-V01',
  '1-V04',
  '1-V05',
  '1-V08',
  '1-V12',
  '1-V23',
  '1-V40',
  '1-V45',
  '1-V48',
  '1-V51',
  '1-Vov'
]

function getAllStopGTFSIDs(stop) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach', false)
  let coachGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional train', false)
  return gtfsIDs.concat(coachGTFSIDs).filter((e, i, a) => a.indexOf(e) == i)
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
  let timetables = db.getCollection('timetables')
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach', true)
  let coachGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional train', true)
  gtfsIDs = gtfsIDs.concat(coachGTFSIDs).filter((e, i, a) => a.indexOf(e) == i)

  let mappedDepartures = []
  let now = utils.now()

  let allGTFSIDs = getAllStopGTFSIDs(stop)

  let runIDsSeen = []

  await async.forEach(gtfsIDs, async stopGTFSID => {
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/3/stop/${stopGTFSID}?gtfs=true&max_results=7&expand=run&expand=route`)
    let coachDepartures = departures.filter(departure => departure.flags.includes('VCH'))

    await async.forEach(coachDepartures, async coachDeparture => {
      let runID = coachDeparture.run_id
      if (runIDsSeen.includes(runID)) return
      runIDsSeen.push(runID)

      let run = runs[runID]
      let route = routes[coachDeparture.route_id]

      let departureTime = moment.tz(coachDeparture.scheduled_departure_utc, 'Australia/Melbourne')
      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime) % 1440

      if (departureTime.diff(now, 'minutes') > 180) return

      let coachRouteGTFSID = route.route_gtfs_id.replace('1-', '5-')
      let trainRouteGTFSID = route.route_gtfs_id

      let destination = utils.adjustStopname(run.destination_name)

      // null: unknown, true: yes, false: no
      let isTrainReplacement = null

      if (!vlineTrainRoutes.includes(trainRouteGTFSID)) isTrainReplacement = false

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'regional coach', null, coachRouteGTFSID)

      if (!trip && (isTrainReplacement !== false)) {
        let stopGTFSIDs = {
          $in: allGTFSIDs
        }
        let checkDest = destination
        if (destination === 'Southern Cross Coach Terminal/Spencer Street')
          checkDest = 'Southern Cross Railway Station'
        if (stop.stopName === 'Southern Cross Coach Terminal/Spencer Street') {
          stopGTFSIDs = 20043
        }

        for (let i = 0; i <= 1; i++) {
          let tripDay = departureTime.clone().add(-i, 'days')
          let departureTimeMinutes = scheduledDepartureTimeMinutes + 1440 * i

          trip = await gtfsTimetables.findDocument({
            routeGTFSID: trainRouteGTFSID,
            operationDays: tripDay.format('YYYYMMDD'),
            mode: 'regional train',
            stopTimings: {
              $elemMatch: {
                stopGTFSID: stopGTFSIDs,
                departureTimeMinutes
              }
            },
            destination: checkDest
          })

          if (trip) {
            console.log(`Mapped train trip as coach: ${trip.departureTime} to ${trip.destination}`)

            trip.mode = 'regional coach'
            trip.routeGTFSID = trip.routeGTFSID.replace('1-', '5-')

            if (trip.origin === 'Southern Cross Railway Station') {
              trip.origin = 'Southern Cross Coach Terminal/Spencer Street'
              trip.stopTimings[0].stopGTFSID = 20836
              trip.stopTimings[0].stopName = trip.origin
            }

            if (trip.destination === 'Southern Cross Railway Station') {
              let lastStop = trip.stopTimings.slice(-1)[0]
              trip.destination = 'Southern Cross Coach Terminal/Spencer Street'
              lastStop.stopGTFSID = 20836
              lastStop.stopName = trip.destination
            }

            delete trip._id
            await liveTimetables.createDocument(trip)


            isTrainReplacement = true
            break
          }
        }
      }

      // Its half trips that never show up properly
      if (!trip) return
      // if (!trip) return console.err(`Failed to map trip: ${departureTime.format('HH:mm')} to ${destination}`)

      mappedDepartures.push({
        trip,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: scheduledDepartureTimeMinutes,
        destination,
        isTrainReplacement: isTrainReplacement
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
}

async function getScheduledDepartures(stop, db, useLive) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'regional coach', 180, useLive)
}

async function getDepartures(stop, db) {
  let cacheKey = stop.stopName + 'C'
  if (departuresCache.get(cacheKey))
    return departuresCache.get(cacheKey)

  if (ptvAPILocks[cacheKey]) {
    return await new Promise(resolve => {
      ptvAPILocks[cacheKey].on('done', data => {
        resolve(data)
      })
    })
  }

  ptvAPILocks[cacheKey] = new EventEmitter()

  function returnDepartures(departures) {
    ptvAPILocks[cacheKey].emit('done', departures)
    delete ptvAPILocks[cacheKey]

    return departures
  }

  let departures
  try {
    departures = await getDeparturesFromPTV(stop, db)
  } catch (e) {
    departures = await getScheduledDepartures(stop, db, false)
    departures = departures.map(departure => {
      departure.isTrainReplacement = null
      return departure
    })
  }

  let timetables = db.getCollection('timetables')

  departures = await async.map(departures, async departure => {
    let destinationShortName = departure.trip.destination.split('/')[0]
    let {destination} = departure.trip
    if (!(utils.isStreet(destinationShortName) || destinationShortName.includes('Information Centre'))) destination = destinationShortName
    destination = destination.replace('Shopping Centre', 'SC')

    if (destinationOverrides[destination])
      departure.destination = destinationOverrides[destination]
    else
      departure.destination = destination

    if (departure.isTrainReplacement === null) {
      let {origin, destination, departureTime, destinationArrivalTime} = departure.trip
      if (origin === 'Southern Cross Coach Terminal/Spencer Street') {
        origin = 'Southern Cross Railway Station'
      }
      if (destination === 'Southern Cross Coach Terminal/Spencer Street') {
        destination = 'Southern Cross Railway Station'
      }

      let hasNSPDeparture = (await timetables.countDocuments({
        mode: 'regional train',
        origin, destination,
        departureTime, destinationArrivalTime
      })) > 0

      departure.isTrainReplacement = hasNSPDeparture
    }
    return departure
  })

  departuresCache.put(cacheKey, Object.values(departures))

  return returnDepartures(Object.values(departures))
}

module.exports = getDepartures
