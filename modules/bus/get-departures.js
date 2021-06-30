const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const stopNameModifier = require('../../additional-data/stop-name-modifier')
const busBays = require('../../additional-data/bus-bays')
const gtfsGroups = require('../gtfs-id-groups')
const departureUtils = require('../utils/get-bus-timetables')
const liveBusData = require('../../additional-data/live-bus-data')

async function getStoppingPatternWithCache(db, busDeparture, destination, isNightBus) {
  let id = busDeparture.scheduled_departure_utc + destination

  return await utils.getData('bus-patterns', id, async () => {
    return await getStoppingPattern(db, busDeparture.run_ref, isNightBus ? 'nbus' : 'bus', busDeparture.scheduled_departure_utc)
  })
}

async function getRoute(db, routeGTFSID, query) {
  return await utils.getData('bus-routes', routeGTFSID, async () => {
    let routes = await db.getCollection('routes').findDocuments({ routeGTFSID: query }, { routePath: 0 }).toArray()
    return routes.find(r => r.routeGTFSID === query) || routes[0]
  })
}

function shouldGetNightbus(now) {
  let minutesAfterMidnight = utils.getMinutesPastMidnight(now)
  let dayOfWeek = utils.getDayOfWeek(now)

  // 11pm - 8.30am (last 969 runs 6.30am - 7.35am, give some buffer for lateness?)
  if (dayOfWeek == 'Fri')
    return minutesAfterMidnight >= 1380
  if (dayOfWeek == 'Sat')
    return minutesAfterMidnight >= 1380 || minutesAfterMidnight <= 510
  if (dayOfWeek == 'Sun')
    return minutesAfterMidnight <= 510
  return false
}

async function updateBusTrips(db, departures) {
  let busTrips = db.getCollection('bus trips')

  let timestamp = +new Date()

  let viableDepartures = departures.filter(d => d.vehicle)

  await async.forEach(viableDepartures, async departure => {
    let { routeGTFSID, origin, destination, departureTime, destinationArrivalTime } = departure.trip
    let smartrakID = parseInt(departure.vehicle.smartrakID)
    let busRego = departure.vehicle.name

    let {routeNumber, vehicle} = departure

    let date = utils.getYYYYMMDD(departure.originDepartureTime)
    let data = {
      date,
      timestamp,
      routeGTFSID,
      smartrakID, routeNumber,
      origin, destination, departureTime, destinationArrivalTime
    }

    await busTrips.replaceDocument({
      date, routeGTFSID, origin, destination, departureTime, destinationArrivalTime
    }, data, {
      upsert: true
    })
  })
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let smartrakIDs = db.getCollection('smartrak ids')
  let dbRoutes = db.getCollection('routes')

  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', true, false)
  let nightbusGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', true, true)

  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', false, false)
    .concat(departureUtils.getUniqueGTFSIDs(stop, 'bus', false, true))
  let mappedDepartures = []
  let now = utils.now()

  let gtfsIDPairs = gtfsIDs.map(s => [s, false])
  if (shouldGetNightbus(now))
    gtfsIDPairs = gtfsIDPairs.concat(nightbusGTFSIDs.map(s => [s, true]))

  let isCheckpointStop = utils.isCheckpointStop(stop.stopName)

  await async.forEach(gtfsIDPairs, async stopGTFSIDPair => {
    let stopGTFSID = stopGTFSIDPair[0],
        isNightBus = stopGTFSIDPair[1]

    let requestTime = now.clone()
    requestTime.add(-30, 'seconds')

    let {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/${isNightBus ? 4 : 2}/stop/${stopGTFSID}?gtfs=true&max_results=9&look_backwards=false&include_cancelled=true&expand=run&expand=route&expand=VehicleDescriptor`)

    let seenIDs = []
    await async.forEach(departures, async busDeparture => {
      if (seenIDs.includes(busDeparture.run_ref)) return
      seenIDs.push(busDeparture.run_ref)
      let run = runs[busDeparture.run_ref]
      let route = routes[busDeparture.route_id]

      if (route.route_number.toLowerCase().includes('combined')) return

      let scheduledDepartureTime = utils.parseTime(busDeparture.scheduled_departure_utc)
      let estimatedDepartureTime = busDeparture.estimated_departure_utc ? utils.parseTime(busDeparture.estimated_departure_utc) : null
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

      // if early at checkpoint set to on time
      if (estimatedDepartureTime && isCheckpointStop) {
        if (scheduledDepartureTime - estimatedDepartureTime > 0) {
          estimatedDepartureTime = scheduledDepartureTime
          actualDepartureTime = estimatedDepartureTime
        }
      }

      if (actualDepartureTime.diff(now, 'minutes') > 90) return

      let destination = stopNameModifier(utils.adjustStopName(run.destination_name.trim()))

      let routeGTFSID = route.route_gtfs_id
      if (routeGTFSID.match(/4-45[abcd]/)) return // The fake 745
      if (routeGTFSID === '4-965') routeGTFSID = '8-965'

      let routeGTFSIDQuery = routeGTFSID, matchingGroup
      if (matchingGroup = gtfsGroups.find(g => g.includes(routeGTFSID))) {
        routeGTFSIDQuery = { $in: matchingGroup }
      }

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTime, destination, 'bus', routeGTFSIDQuery)
        || await getStoppingPatternWithCache(db, busDeparture, destination, isNightBus)

      let hasVehicleData = run.vehicle_descriptor
      let vehicleDescriptor = hasVehicleData ? run.vehicle_descriptor : {}

      let busRego
      let smartrakID = vehicleDescriptor.id
      if (vehicleDescriptor.supplier === 'Smartrak') {
        busRego = (await smartrakIDs.findDocument({
          smartrakID: parseInt(smartrakID)
        }) || {}).fleetNumber
      }

      let busRoute = await getRoute(db, routeGTFSID, routeGTFSIDQuery)
      let operator = busRoute.operators.sort((a, b) => a.length - b.length)[0]

      if (busRoute.operationDate) {
        let cutoff = utils.now().startOf('day')
        if (busRoute.operationDate.type === 'until' && busRoute.operationDate.operationDate < cutoff) {
          return
        }
      }

      if (!operator) operator = ''

      let {routeNumber} = trip
      let sortNumber = routeNumber || ''

      if (routeGTFSID.startsWith('7-')) {
        sortNumber = routeNumber.slice(2)
      }

      let loopDirection
      if (busRoute.flags)
        loopDirection = busRoute.flags[trip.gtfsDirection]

      let firstStop = trip.stopTimings[0]
      let currentStop = trip.stopTimings.find(stop => allGTFSIDs.includes(stop.stopGTFSID))
      if (!currentStop) global.loggers.error.err(trip, allGTFSIDs)
      let minutesDiff = currentStop.departureTimeMinutes - firstStop.departureTimeMinutes
      let originDepartureTime = scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

      mappedDepartures.push({
        trip,
        originDepartureTime,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: trip.destination,
        vehicle: smartrakID ? {
          name: busRego || smartrakID,
          smartrakID,
          attributes: null
        } : null,
        routeNumber,
        sortNumber,
        isNightBus,
        operator,
        codedOperator: utils.encodeName(operator.replace(/ \(.+/, '')),
        loopDirection,
        routeDetails: trip.routeDetails,
        isLiveTrip: busDeparture.run_ref.includes('-'),
        runID: busDeparture.run_ref
      })
    })
  })

  let liveTrips = mappedDepartures.filter(departure => departure.isLiveTrip)
  let scheduledTrips = mappedDepartures.filter(departure => !departure.isLiveTrip)

  let tripIDs = []
  let filteredLiveDepartures = liveTrips.filter(d => {
    if (d.trip.routeGTFSID == '4-601') return true

    let tripID = d.trip.origin + d.trip.departureTime + d.trip.destination + d.trip.destinationArrivalTime

    if (!tripIDs.includes(tripID)) {
      tripIDs.push(tripID)
      return true
    } else return false
  })

  let filteredDepartures = filteredLiveDepartures.concat(scheduledTrips.filter(d => {
    let tripID = d.trip.origin + d.trip.departureTime + d.trip.destination + d.trip.destinationArrivalTime

    return !tripIDs.includes(tripID)
  }))

  await updateBusTrips(db, filteredDepartures)

  return filteredDepartures
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'bus', 90, false)
}

async function getDepartures(stop, db) {
  let cacheKey = stop.codedSuburb[0] + stop.stopName

  try {
    return await utils.getData('bus-departures', cacheKey, async () => {
      let scheduledDepartures = await getScheduledDepartures(stop, db, false)

      let departures
      try {
        let ptvDepartures = await getDeparturesFromPTV(stop, db)

        function i (trip) { return `${trip.routeGTFSID}${trip.origin}${trip.departureTime}` }
        let tripIDsSeen = ptvDepartures.map(d => i(d.trip))

        let now = utils.now()
        let extraScheduledTrips = scheduledDepartures.filter(d => !tripIDsSeen.includes(i(d.trip)) && d.actualDepartureTime.diff(now, 'seconds') > -75)
        extraScheduledTrips = extraScheduledTrips.filter(d => d.trip.routeGTFSID !== '4-601')

        departures = ptvDepartures.concat(extraScheduledTrips)

        if (stop.stopName === 'Monash University Bus Loop') {
          departures = departures.filter(departure => { // Filter off scheduled departures, but only do it once
            if (departure.trip.routeGTFSID === '4-601') {
              if (!departure.runID) return false

              return parseInt(departure.runID.slice(departure.runID.lastIndexOf('-') + 1)) < 200
            } else return true
          })
        }
      } catch (e) {
        global.loggers.general.err('Failed to get bus timetables', e)
        departures = scheduledDepartures
      }

      departures = departures.sort((a, b) => {
        return a.actualDepartureTime - b.actualDepartureTime
      })

      let nightBusIncluded = shouldGetNightbus(utils.now())
      let shouldShowRoad = stop.bays.filter(bay => {
        return bay.mode === 'bus'
          && (nightBusIncluded ^ !(bay.flags && bay.flags.isNightBus && !bay.flags.hasRegularBus))
      }).map(bay => {
        let {fullStopName} = bay
        if (fullStopName.includes('/')) {
          return fullStopName.replace(/\/\d+[a-zA-z]? /, '/')
        } else return fullStopName
      }).filter((e, i, a) => a.indexOf(e) === i).length > 1

      let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)

      let busTrips = db.getCollection('bus trips')
      let smartrakIDs = db.getCollection('smartrak ids')

      return await async.map(departures, async departure => {
        let {trip} = departure

        if (!departure.vehicle) {
          let trip = departure.trip
          let { routeGTFSID } = trip
          let shouldCheck = routeGTFSID.startsWith('8-')
            || (routeGTFSID.startsWith('4-') && !liveBusData.metroRoutesExcluded.includes(routeGTFSID))
            || liveBusData.regionalRoutes.includes(routeGTFSID)

          if (shouldCheck) {
            let query = {
              date: utils.getYYYYMMDD(departure.originDepartureTime),
              routeGTFSID,
              origin: trip.origin,
              destination: trip.destination,
              departureTime: trip.departureTime,
              destinationArrivalTime: trip.destinationArrivalTime
            }

            let vehicle = await busTrips.findDocument(query)

            if (vehicle) {
              let { smartrakID } = vehicle
              let smartrak = await smartrakIDs.findDocument({ smartrakID })
              departure.vehicle = {
                name: smartrak ? smartrak.fleetNumber : smartrakID,
                smartrakID,
                attributes: null
              }
            }
          }
        }

        let hasSeenStop = false
        let upcomingStops = trip.stopTimings.filter(tripStop => {
          if (stopGTFSIDs.includes(tripStop.stopGTFSID)) {
            hasSeenStop = true
          }
          return hasSeenStop
        })

        let departureBayID = upcomingStops[0].stopGTFSID
        let bay = busBays[departureBayID]
        let departureRoad = (upcomingStops[0].stopName.split('/').slice(-1)[0] || '').replace(/^\d+[a-zA-z]? /)

        departure.bay = bay
        departure.departureRoad = departureRoad

        let importantStops = upcomingStops.map(stop => utils.getStopName(stop.stopName))
          .filter((e, i, a) => a.indexOf(e) === i)
          .slice(1, -1)
          .filter(utils.isCheckpointStop)
          .map(utils.shorternStopName)

        if (importantStops.length)
          departure.viaText = `Via ${importantStops.slice(0, -1).join(', ')}${(importantStops.length > 1 ? ' & ' : '') + importantStops.slice(-1)[0]}`

        if (departure.bay && !departure.routeNumber) {
          if (shouldShowRoad && departure.departureRoad) {
            departure.guidanceText = `Departing ${departure.departureRoad}, ${departure.bay}`
          } else {
            departure.guidanceText = `Departing ${departure.bay}`
          }
        } else if (shouldShowRoad && departure.departureRoad) {
          departure.guidanceText = `Departing ${departure.departureRoad}`
        }

        if (departure.loopDirection === 'Anti-Clockwise') {
          departure.loopDirection = 'AC/W'
        } else if (departure.loopDirection === 'Clockwise') {
          departure.loopDirection = 'C/W'
        }

        return departure
      })
    }, 1000 * 30)
  } catch (e) {
    throw e
  }
}

module.exports = getDepartures
