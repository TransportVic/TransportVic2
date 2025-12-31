import { LokiDatabaseConnection } from '@transportme/database'
import { expect } from 'chai'
import gtfsr273TripUpdate from './sample-data/gtfsr-273-trip-update.mjs'
import { getUpcomingTrips } from '../../../modules/new-tracker/bus/bus-gtfsr-trips.mjs'
import gtfs273 from './sample-data/gtfs-273.mjs'
import BusTripUpdater from '../../../modules/bus/trip-updater.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The bus trips updater', () => {
  it.only('Attempts to match a trip using just the run ID from any day if unable to match for today', async () => {
    const database = new LokiDatabaseConnection()
    const gtfsTimetables = database.getCollection('gtfs timetables')
    const liveTimetables = database.getCollection('live timetables')
    await gtfsTimetables.createDocument(clone(gtfs273))
    const tripUpdate = Object.values(await getUpcomingTrips(() => gtfsr273TripUpdate))

    await BusTripUpdater.updateTrip(database, database, tripUpdate[0], {
      dataSource: 'test',
      skipStopCancellation: true,
      propagateDelay: true
    })

    const trip = await liveTimetables.findDocument({})
    expect(trip).to.exist
    expect(trip.origin).to.equal('The Pines Shopping Centre/Reynolds Road')
    expect(trip.departureTime).to.equal('12:45')
    expect(trip.destination).to.equal('Nunawading Railway Station/Station Street')
  })
})