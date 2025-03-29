import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleLiveTrips from './sample-data/sample-live-trips.json' with { type: 'json' }
import sampleSchTrips from './sample-data/sample-sch-trips.json' with { type: 'json' }
import alamein from './sample-data/alamein.json' with { type: 'json' }
import { fetchLiveTrips, fetchScheduledTrips } from '../get-departures.js'

const db = new LokiDatabaseConnection()
db.connect()
db.createCollection('gtfs timetables')
let gtfsTrips = await db.createCollection('gtfs timetables')
let liveTrips = await db.createCollection('live timetables')

await gtfsTrips.createDocuments(sampleSchTrips)
await liveTrips.createDocuments(sampleLiveTrips)

describe('The fetchLiveTrips function', () => {
  it('Should return trip data from the live timetables collection', async () => {
    let trips = await fetchLiveTrips(alamein, db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)
  })
})

describe('The fetchScheduledTrips function', () => {
  it('Should return trip data from the gtfs timetables collection, with scheduled times to match the given departure day', async () => {
    let trips = await fetchScheduledTrips(alamein, db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T21:08:00.000Z') // 08:08
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T21:28:00.000Z') // 08:28
  })
})