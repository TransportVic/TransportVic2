import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }

import rawLineRanges from '../../../additional-data/metro-tracker/line-ranges.mjs'
import utils from '../../../utils.mjs'
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

const tdnToLine = {}
Object.keys(rawLineRanges).forEach(line => {
  let ranges = rawLineRanges[line]
  ranges.forEach(range => {
    let lower = range[0]
    let upper = range[1]
    let prefix = range[2] || ''

    for (let n = lower; n <= upper; n++) {
      if (n < 1000) {
        n = utils.pad(n.toString(), prefix ? 3 : 4, '0')
      }
      let tdn = prefix + n
      tdnToLine[tdn] = line
    }
  })
})

export async function getDepartures(db, ptvAPI) {
  const trips = await ptvAPI.metroSite.getDepartures()
  const output = []
  for (const trip of trips) {
    const routeName = tdnToLine[trip.tdn]
    if (!routeName) {
      global.loggers.trackers.metro.warn('Could not determine route for TD' + trip.tdn)
    }

    const routeData = routeName ? await MetroTripUpdater.getRouteByName(db, routeName) : null

    const tripData = {
      operationDays: trip.operationalDate,
      runID: trip.tdn,
      stops: trip.stops.map(stop => {
        let data = {
          stopName: stop.stationName + ' Railway Station',
          platform: stop.platform,
          scheduledDepartureTime: new Date(stop.scheduledDeparture.toUTC().toISO()),
        }

        if (stop.estimatedDeparture) data.estimatedDepartureTime = new Date(stop.estimatedDeparture.toUTC().toISO())
        if (stop.estimatedArrival) data.estimatedArrivalTime = new Date(stop.estimatedArrival.toUTC().toISO())
        return data
      })
    }

    if (routeData) tripData.routeGTFSID = routeData.routeGTFSID
    output.push(tripData)
  }
  return output
}

export async function fetchMetroSiteDepartures(db, tripDB, ptvAPI, existingTrips) {
  let trips = await getDepartures(db, ptvAPI)
  global.loggers.trackers.metro.log('MTM Departures: Fetched', trips.length, 'trips')

  for (let tripData of trips) {
    await MetroTripUpdater.updateTrip(db, tripDB, tripData, {
      skipStopCancellation: true,
      dataSource: 'mtm-departures',
      updateTime: new Date(),
      existingTrips,
      skipWrite: true,
      fullTrip: true
    })
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  await fetchMetroSiteDepartures(database, tripDatabase, ptvAPI)

  process.exit(0)
}