import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleTrips from './sample-trips.json' with { type: 'json' }
import alamein from './alamein.json' with { type: 'json' }
import { fetchLiveTrips } from '../get-departures.js'

const db = new LokiDatabaseConnection()
db.connect()
db.createCollection('gtfs timetables')
let dbTrips = await db.createCollection('live timetables')

dbTrips.createDocuments(sampleTrips)

describe('The fetchLiveTrips function', () => {
  it('Should return trip data from the live timetables collection', async () => {
    let trips = await fetchLiveTrips(alamein, db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)
  })
})