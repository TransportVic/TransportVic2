const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const stopNameModifier = require('../../additional-data/stop-name-modifier')
const busBays = require('../../additional-data/bus-bays')
const departureUtils = require('../utils/get-bus-timetables')

const regionalRouteNumbers = require('../../additional-data/bus-data/regional-with-track')

let regionalGTFSIDs = Object.keys(regionalRouteNumbers).reduce((acc, region) => {
  let regionRoutes = regionalRouteNumbers[region]

  regionRoutes.forEach(route => {
    acc[route.routeGTFSID] = { region, routeNumber: route.routeNumber }
  })

  return acc
}, {})

async function getStoppingPatternWithCache(db, busDeparture, destination) {
  let id = busDeparture.scheduled_departure_utc + destination

  return await utils.getData('bus-patterns', id, async () => {
    return await getStoppingPattern(db, busDeparture.run_ref, 'bus', busDeparture.scheduled_departure_utc)
  })
}

async function getRoute(db, cacheKey, query) {
  return await utils.getData('bus-routes', cacheKey, async () => {
    return await db.getCollection('routes').findDocument(query, { routePath: 0 })
  })
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

  let uniqueStops = departureUtils.getUniqueGTFSIDs(stop, 'bus', true)
  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', false)

  let mappedDepartures = []
  let now = utils.now()

  let isCheckpointStop = utils.isCheckpointStop(stop.stopName)

  await async.forEach(uniqueStops, async stopGTFSID => {
    let requestTime = now.clone()
    requestTime.add(-30, 'seconds')

    let bayType = ''
    let matchedBay = stop.bays.find(bay => bay.mode === 'bus' && bay.stopGTFSID === stopGTFSID)

    let bays = stop.bays.filter(bay => bay.mode === 'bus' && bay.fullStopName === matchedBay.fullStopName)
    let screenServices = bays.map(bay => bay.screenServices).reduce((a, e) => a.concat(e), [])

    if (screenServices.some(svc => svc.routeGTFSID.startsWith('4-'))) { // Metro bus stop
      bayType = 'metro'
    } else { // Regional/Skybus
      if (screenServices.some(svc => regionalGTFSIDs[svc.routeGTFSID])) {
        bayType = 'regional-live'
      } else {
        bayType = 'regional'
      }
    }

    if (bayType === 'regional') return // Bay does not have any live routes - skip requesting data and use scheduled

    let {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/2/stop/${stopGTFSID}?gtfs=true&max_results=9&look_backwards=false&include_cancelled=true&expand=run&expand=route&expand=VehicleDescriptor`)

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

      let trip, routeGTFSID, routeGTFSIDQuery
      let ptvRouteNumber = route.route_number
      let busRoute

      if (bayType === 'metro') {
        busRoute = await getRoute(db, `M-${ptvRouteNumber}`, {
          routeNumber: ptvRouteNumber,
          routeGTFSID: /^4-/
        })

        routeGTFSID = busRoute.routeGTFSID
      } else if (bayType === 'regional-live') {
        let liveRoute = screenServices.find(svc => regionalGTFSIDs[svc.routeGTFSID])
        let routeData = regionalGTFSIDs[liveRoute.routeGTFSID]

        let routeGTFSID = {
          $in: regionalRouteNumbers[routeData.region].filter(route => route.routeNumber === ptvRouteNumber).map(route => route.routeGTFSID)
        }
      }

      trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTime, destination, 'bus', routeGTFSID, [], 1, null)
      if (!trip) trip = await getStoppingPatternWithCache(db, busDeparture, destination)

      if (!busRoute) {
        routeGTFSID = trip.routeGTFSID

        busRoute = await getRoute(db, `${trip.routeGTFSID}`, {
          routeGTFSID
        })
      }

      let hasVehicleData = run.vehicle_descriptor
      let vehicleDescriptor = hasVehicleData ? run.vehicle_descriptor : {}

      let busRego
      let smartrakID = vehicleDescriptor.id
      if (vehicleDescriptor.supplier === 'Smartrak') {
        busRego = (await smartrakIDs.findDocument({
          smartrakID: parseInt(smartrakID)
        }) || {}).fleetNumber
      }

      let operator = busRoute.operators.sort((a, b) => a.length - b.length)[0] || ''

      if (busRoute.operationDate) {
        let cutoff = utils.now().startOf('day')
        if (busRoute.operationDate.type === 'until' && busRoute.operationDate.operationDate < cutoff) {
          return
        }
      }

      let { routeNumber } = trip
      let sortNumber = routeNumber || ''

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
        operator,
        codedOperator: utils.encodeName(operator.replace(/ \(.+/, '')),
        loopDirection,
        routeDetails: trip.routeDetails,
        isLiveTrip: busDeparture.run_ref.includes('-'),
        runID: busDeparture.run_ref,
        tripID: trip.origin + trip.departureTime + trip.destination + trip.destinationArrivalTime
      })
    })
  })

  let liveTrips = mappedDepartures.filter(departure => departure.isLiveTrip)
  let scheduledTrips = mappedDepartures.filter(departure => !departure.isLiveTrip)

  let potentialDuplicateLiveTrips = []

  let tripIDs = []
  let filteredLiveDepartures = liveTrips.filter(d => {
    let tripID = d.tripID

    if (!tripIDs.includes(tripID)) {
      tripIDs.push(tripID)
      return true
    } else {
      potentialDuplicateLiveTrips.push(tripID)
      return false
    }
  })

  potentialDuplicateLiveTrips.forEach(tripID => {
    let trips = liveTrips.filter(trip => trip.tripID === tripID)
    let hasLive = trips.filter(trip => trip.vehicle || trip.estimatedDepartureTime)

    if (hasLive.length === 0) hasLive = trips[0]
    filteredLiveDepartures = filteredLiveDepartures.filter(trip => trip.tripID !== tripID).concat(hasLive)
  })

  let filteredDepartures = filteredLiveDepartures.concat(scheduledTrips.filter(d => {
    return !tripIDs.includes(d.tripID)
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
      let scheduledDepartures = []
      let ptvDepartures = []
      let departures = []
      let ptvFailed = false, scheduledFailed = false

      await Promise.all([new Promise(async resolve => {
        try {
          scheduledDepartures = await getScheduledDepartures(stop, db, false)
        } catch (e) {
          global.loggers.general.err('Failed to get schedule departures', e)
          scheduledFailed = true
        } finally { resolve() }
      }), new Promise(async resolve => {
        try {
          ptvDepartures = await getDeparturesFromPTV(stop, db)
        } catch (e) {
          global.loggers.general.err('Failed to get PTV departures', e)
          ptvFailed = true
        } finally { resolve() }
      })])

      let nonLiveDepartures = scheduledDepartures.filter(departure => {
        let { routeGTFSID } = departure.trip
        return !(routeGTFSID.startsWith('4-') || regionalGTFSIDs[routeGTFSID])
      })

      departures = [...ptvDepartures, ...nonLiveDepartures]
      if (ptvFailed) departures = scheduledDepartures
      if (ptvFailed && scheduledFailed) throw new Error('Both PTV and Scheduled timetables unavailable')

      departures = departures.sort((a, b) => {
        return a.actualDepartureTime - b.actualDepartureTime
      })

      let shouldShowRoad = stop.bays.filter(bay => {
        return bay.mode === 'bus'
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
          let shouldCheck = routeGTFSID.startsWith('4-') || regionalGTFSIDs[routeGTFSID]

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
