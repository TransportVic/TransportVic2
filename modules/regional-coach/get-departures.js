const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const destinationOverrides = require('../../additional-data/coach-stops')
const EventEmitter = require('events')
const busBays = require('../../additional-data/bus-bays')
const southernCrossBays = require('../../additional-data/southern-cross-bays')

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
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/3/stop/${stopGTFSID}?gtfs=true&max_results=15&expand=run&expand=route`)
    let coachDepartures = departures.filter(departure => departure.flags.includes('VCH'))

    let tripIDsSeen = []

    await async.forEachSeries(coachDepartures, async coachDeparture => {
      let runID = coachDeparture.run_id
      if (runIDsSeen.includes(runID)) return
      runIDsSeen.push(runID)

      let run = runs[runID]
      let route = routes[coachDeparture.route_id]

      let departureTime = utils.parseTime(coachDeparture.scheduled_departure_utc)
      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime) % 1440

      if (departureTime.diff(now, 'minutes') > 60 * 12) return

      let coachRouteGTFSID = route.route_gtfs_id.replace('1-', '5-')
      let trainRouteGTFSID = route.route_gtfs_id

      let destination = utils.adjustStopName(run.destination_name)

      // null: unknown, true: yes, false: no
      let isTrainReplacement = null

      if (!vlineTrainRoutes.includes(trainRouteGTFSID)) isTrainReplacement = false

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'regional coach', null, coachRouteGTFSID, tripIDsSeen)

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
            destination: checkDest,
            tripID: {
              $not: {
                $in: tripIDsSeen
              }
            }
          })

          if (trip) {
            console.log(`Mapped train trip as coach: ${trip.departureTime} to ${trip.destination}`)

            let operationDay = tripDay.format('YYYYMMDD')
            trip.operationDays = [ operationDay ]

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

            let query = {
              origin: trip.origin,
              destination: trip.destination,
              operationDays: operationDay,
              departureTime: trip.departureTime,
              destinationArrivalTime: trip.destinationArrivalTime
            }

            delete trip._id
            await liveTimetables.replaceDocument(query, trip, {
              $upsert: true
            })

            isTrainReplacement = true
            break
          }
        }
      }

      // Its half trips that never show up properly
      if (!trip) return
      // if (!trip) return console.err(`Failed to map trip: ${departureTime.format('HH:mm')} to ${destination}`)

      tripIDsSeen.push(trip.tripID)

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

  try {
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
    let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

    departures = await async.map(departures, async departure => {
      let {destination} = departure.trip
      destination = destination.replace('Shopping Centre', 'SC')
      destination = destinationOverrides[destination] || destination

      let shortName = utils.getStopName(destination)
      if (!utils.isStreet(shortName)) destination = shortName

      departure.destination = destination

      let departureBayID = departure.trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID)).stopGTFSID
      let bay
      if (departureBayID === 20836) { // southern cross
        departure.bay = southernCrossBays[departure.trip.routeGTFSID]
      } else {
        departure.bay = busBays[departureBayID]
      }

      if (departure.isTrainReplacement === null) {
        let {origin, destination, departureTime} = departure.trip
        if (origin === 'Southern Cross Coach Terminal/Spencer Street') {
          origin = 'Southern Cross Railway Station'
        }
        if (destination === 'Southern Cross Coach Terminal/Spencer Street') {
          destination = 'Southern Cross Railway Station'
        }

        let nspDeparture = await timetables.findDocument({
          mode: 'regional train',
          origin,
          'stopTimings.stopName': destination,
          departureTime
        })
        departure.isTrainReplacement = !!nspDeparture
        if (nspDeparture) {
          departure.shortRouteName = nspDeparture.routeName
        }
      }
      return departure
    })

    let trainReplacements = []
    departures.forEach(departure => {
      if (departure.isTrainReplacement) {
        trainReplacements.push({
          routeGTFSID: departure.trip.routeGTFSID,
          departureTime: departure.trip.stopTimings[0].departureTime,
          direction: departure.trip.gtfsDirection,
          shortRouteName: departure.shortRouteName
        })
      }
    })

    departures = departures.map(departure => {
      if (!departure.isTrainReplacement) {
        let combinedTR = trainReplacements.find(t => {
          return t.routeGTFSID === departure.trip.routeGTFSID
            && t.departureTime === departure.trip.stopTimings[0].departureTime
            && t.direction === departure.trip.gtfsDirection
        })

        if (combinedTR) {
          departure.isTrainReplacement = true
          departure.shortRouteName = combinedTR.shortRouteName
        }
      }

      return departure
    })

    departuresCache.put(cacheKey, departures)
    return returnDepartures(departures)
  } catch (e) {
    return returnDepartures(null)
  }
}

module.exports = getDepartures
