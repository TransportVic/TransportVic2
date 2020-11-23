const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const destinationOverrides = require('../../additional-data/coach-stops')
const busBays = require('../../additional-data/bus-bays')
const southernCrossBays = require('../../additional-data/southern-cross-bays')
const { getDayOfWeek } = require('../../public-holidays')

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
      let runID = coachDeparture.run_ref
      if (runIDsSeen.includes(runID)) return
      runIDsSeen.push(runID)

      let run = runs[runID]
      let route = routes[coachDeparture.route_id]

      let departureTime = utils.parseTime(coachDeparture.scheduled_departure_utc)
      let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)

      if (departureTime.diff(now, 'minutes') > 60 * 12) return

      let coachRouteGTFSID = route.route_gtfs_id.replace('1-', '5-')
      let trainRouteGTFSID = route.route_gtfs_id

      let destination = utils.adjustStopName(run.destination_name)

      // null: unknown, true: yes, false: no
      let isRailReplacementBus = null

      if (!vlineTrainRoutes.includes(trainRouteGTFSID)) isRailReplacementBus = false

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, departureTime, destination, 'regional coach', coachRouteGTFSID, tripIDsSeen)

      if (!trip && (isRailReplacementBus !== false)) {
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
          let operationDay = utils.getYYYYMMDD(tripDay)

          trip = await gtfsTimetables.findDocument({
            routeGTFSID: trainRouteGTFSID,
            operationDays: operationDay,
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
            global.loggers.general.info(`Mapped train trip as coach: ${trip.departureTime} to ${trip.destination}`)

            trip.operationDays = operationDay

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
              upsert: true
            })

            isRailReplacementBus = true
            break
          }
        }
      }

      // Its half trips that never show up properly
      if (!trip) return

      tripIDsSeen.push(trip.tripID)

      mappedDepartures.push({
        trip,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: departureTime,
        destination,
        isRailReplacementBus
      })
    })
  })

  return mappedDepartures
}

async function getScheduledDepartures(stop, db, useLive) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'regional coach', 180, useLive)
}

async function getDepartures(stop, db) {
  try {
    return await utils.getData('coach-departures', stop.stopName, async () => {
      let departures
      let scheduledDepartures = (await getScheduledDepartures(stop, db, false)).map(departure => {
        departure.isRailReplacementBus = null
        return departure
      })

      try {
        departures = await getDeparturesFromPTV(stop, db)
        let ptvDepartures = departures.map(d => d.trip.tripID)
        let extras = scheduledDepartures.filter(d => !ptvDepartures.includes(d.trip.tripID))
        departures = departures.concat(extras)
      } catch (e) {
        global.loggers.general.err('Failed to get coach trips', e)
        departures = scheduledDepartures
      }

      departures = departures.sort((a, b) => a.destination.length - b.destination.length)
        .sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)

      let timetables = db.getCollection('timetables')
      let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

      departures = await async.map(departures, async departure => {
        let destination = destinationOverrides(departure.trip.stopTimings.slice(-1)[0])
        if (departure.trip.destination.includes(' Railway Station')) {
          destination = departure.trip.destination.split('/')[0]
        }

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

        if (departure.trip.trainConnection) {
          departure.isRailReplacementBus = true
          departure.shortRouteName = departure.trip.trainConnection
        }

        if (departure.isRailReplacementBus === null) {
          let {origin, destination, departureTime} = departure.trip

          let currentStop = departure.trip.stopTimings.find(tripStop => stopGTFSIDs.includes(tripStop.stopGTFSID))
          let minutesDiff = currentStop.departureTimeMinutes - departure.trip.stopTimings[0].departureTimeMinutes

          let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
          if (utils.getMinutesPastMidnight(tripStart) < 180) tripStart.add(-1, 'day')
          let operationDay = await getDayOfWeek(tripStart)

          if (origin === 'Southern Cross Coach Terminal/Spencer Street') {
            origin = 'Southern Cross Railway Station'
          }
          if (destination === 'Southern Cross Coach Terminal/Spencer Street') {
            destination = 'Southern Cross Railway Station'
          }

          let nspDeparture = await timetables.findDocument({
            mode: 'regional train',
            operationDays: operationDay,
            origin,
            'stopTimings.stopName': destination,
            departureTime
          })

          departure.isRailReplacementBus = !!nspDeparture
          if (nspDeparture) {
            departure.shortRouteName = nspDeparture.routeName
          }
        }
        return departure
      })

      let trainReplacements = []
      departures.forEach(departure => {
        if (departure.isRailReplacementBus) {
          trainReplacements.push({
            routeGTFSID: departure.trip.routeGTFSID,
            departureTime: departure.trip.stopTimings[0].departureTime,
            direction: departure.trip.gtfsDirection,
            shortRouteName: departure.shortRouteName
          })
        }
      })

      return departures.map(departure => {
        if (!departure.isRailReplacementBus) {
          let combinedTR = trainReplacements.find(t => {
            return t.routeGTFSID === departure.trip.routeGTFSID
              && t.departureTime === departure.trip.stopTimings[0].departureTime
              && t.direction === departure.trip.gtfsDirection
          })

          if (combinedTR) {
            departure.isRailReplacementBus = true
            departure.shortRouteName = combinedTR.shortRouteName
          }
        }

        return departure
      })
    })
  } catch (e) {
    global.loggers.general.err(e)
    return null
  }
}

module.exports = getDepartures
