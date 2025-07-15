import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import shmTransposals from './sample-data/shm-transposals.json' with { type: 'json' }
import { updateTrip } from '../../../metro-trains/trip-updater.mjs'
import { getTripsRequiringUpdates } from '../check-new-updates.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The changelog tracker', () => {
  it.only('Takes a list of trips and their changes and identifies those needing further updates', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(shmTransposals))
    let changes = [{
      operationDays: "20250713",
      runID: "X100",
      forming: "X101",
    },
    {
      operationDays: "20250713",
      runID: "X103",
      forming: "X110",
      formedBy: "X102"
    }]

    let updatedTrips = [await updateTrip(db, changes[0]), await updateTrip(db, changes[1])]
    let tripsNeedingUpdate = getTripsRequiringUpdates(updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.equal([
      'X101', 'X110', 'X102'
    ])
  })
})