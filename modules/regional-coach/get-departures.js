const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 5 })
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const destinationOverrides = require('../../additional-data/coach-destinations')

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
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach', true)
  let coachGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional train', true)
  gtfsIDs = gtfsIDs.concat(coachGTFSIDs).filter((e, i, a) => a.indexOf(e) == i)

  let mappedDepartures = []
  let now = utils.now()

  let allGTFSIDs = getAllStopGTFSIDs(stop)

  await async.forEach(gtfsIDs, async stopGTFSID => {
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/3/stop/${stopGTFSID}?gtfs=true&max_results=5&expand=run&expand=route`)
    let coachDepartures = departures.filter(departure => departure.flags.includes('VCH'))

    await async.forEach(coachDepartures, async coachDeparture => {
      let run = runs[coachDeparture.run_id]
      let route = routes[coachDeparture.route_id]

      let departureTime = moment.tz(coachDeparture.scheduled_departure_utc, 'Australia/Melbourne')
      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime)
      if (departureTime.diff(now, 'minutes') > 300) return

      let coachRouteGTFSID = route.route_gtfs_id.replace('1-', '5-')
      let trainRouteGTFSID = route.route_gtfs_id

      let destination = utils.adjustStopname(run.destination_name)
      let isTrainReplacement = null

      if (!vlineTrainRoutes.includes(trainRouteGTFSID)) isTrainReplacement = false

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'regional coach', null, coachRouteGTFSID)
      if (!trip && (isTrainReplacement !== null)) {
        let stopGTFSIDs = {
          $in: allGTFSIDs
        }
        if (stop.stopName === 'Southern Cross Coach Terminal/Spencer Street') {
          stopGTFSIDs = 20043
        }

        for (let i = 0; i <= 1; i++) {
          let tripDay = departureTime.clone().add(-i, 'days')
          let query = {
            routeGTFSID: trainRouteGTFSID,
            operationDays: tripDay.format('YYYYMMDD'),
            mode: 'regional train',
            stopTimings: {
              $elemMatch: {
                stopGTFSID: stopGTFSIDs,
                departureTimeMinutes: scheduledDepartureTimeMinutes % 1440 + 1440 * i
              }
            },
            destination
          }

          trip = await gtfsTimetables.findDocument(query)
          if (trip) {
            console.log(`Mapped train trip as coach: ${trip.departureTime} to ${trip.destination}`)
            isTrainReplacement = true
            break
          }
        }
      }

      // Its half trips that never show up properly
      if (!trip) return
      // if (!trip) return console.err(`Failed to map trip: ${departureTime.format('HH:MM')} to ${destination}`)

      if (destinationOverrides[destination])
        destination = destinationOverrides[destination]

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
  if (departuresCache.get(stop.stopName + 'C')) return departuresCache.get(stop.stopName + 'C')

  let departures
  try {
    departures = await getDeparturesFromPTV(stop, db)
  } catch (e) {
    departures = await getScheduledDepartures(stop, db, false)
  }

  let timetables = db.getCollection('timetables')

  departures = await async.map(departures, async departure => {
    if (departure.isTrainReplacement === null) {
      let {origin, destination, departureTime, destinationArrivalTime} = departure.trip
      if (origin === 'Southern Cross Coach Terminal/Spencer Street') {
        origin = 'Southern Cross Railway Station'
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

  departuresCache.put(stop.stopName + 'C', Object.values(departures))

  return Object.values(departures)
}

module.exports = getDepartures
