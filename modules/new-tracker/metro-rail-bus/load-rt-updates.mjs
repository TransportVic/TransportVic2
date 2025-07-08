import { PTVAPI } from '@transportme/ptv-api'
import utils from '../../../utils.js'
import { fileURLToPath } from 'url'

export async function getRailBusUpdates(ptvAPI) {
  let tripUpdates = await ptvAPI.metroSite.getRailBusUpdates()

  let output = []
  for (let trip of tripUpdates) {
    let tripData = {
      operationDays: utils.getYYYYMMDDNow(),
      tripID: trip.tripID,
      routeGTFSID: '2-RRB',
      stops: trip.stopTimings.map(stop => ({
        stopGTFSID: stop.stopGTFSID,
        estimatedDepartureTime: stop.estimatedDepartureTime.toUTC().toISO(),
        estimatedArrivalTime: stop.estimatedDepartureTime.toUTC().toISO()
      }))
    }

    output.push(tripData)
  }

  return output
}

export async function fetchTrips(db, ptvAPI) {
  let relevantTrips = await getRailBusUpdates(ptvAPI)
  console.log('MTM Rail Bus: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await updateTrip(db, tripData, { dataSource: 'mtm-website-rail' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(new PTVAPI())

  process.exit(0)
}