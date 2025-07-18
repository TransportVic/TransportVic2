import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }

import rawLineRanges from '../../../additional-data/metro-tracker/line-ranges.js'
import utils from '../../../utils.js'
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'

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
  let trips = await ptvAPI.metroSite.getDepartures()
  let output = []
  for (let trip of trips) {
    let routeName = tdnToLine[trip.tdn]
    if (!routeName) {
      console.warn('Could not determine route for TD' + trip.tdn)
      continue
    }

    let routeData = await MetroTripUpdater.getRouteByName(db, routeName)

    let tripData = {
      operationDays: trip.operationalDate,
      runID: trip.tdn,
      routeGTFSID: routeData.routeGTFSID,
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
    output.push(tripData)
  }
  return output
}

export async function fetchTrips(ptvAPI, db) {
  let trips = await getDepartures(db, ptvAPI)
  console.log('MTM Departures: Fetched', trips.length, 'trips')

  for (let tripData of trips) {
    await MetroTripUpdater.updateTrip(db, tripData, { skipStopCancellation: true, dataSource: 'mtm-departures', updateTime: new Date() })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  await fetchTrips(ptvAPI, mongoDB)

  process.exit(0)
}