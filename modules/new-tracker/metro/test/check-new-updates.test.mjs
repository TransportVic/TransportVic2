import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import shmTransposals from './sample-data/shm-transposals.json' with { type: 'json' }
import { updateTrip } from '../../../metro-trains/trip-updater.mjs'
import { getTripsRequiringUpdates } from '../check-new-updates.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The changelog tracker', () => {
  it.only('Ensures updates to forming data also updates the respective formedBy data', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(shmTransposals))
    // X100 forming updated to X103
    // Original forming of X101 needs to update formedBy
    // X103 formedBy also needs to be updated
    let changes = [{
      operationDays: "20250713",
      runID: "X100",
      forming: "X103"
    }]

    let updatedTrips = [await updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([
      'X101', 'X103'
    ])
  })

  it.only('Ensures updates to formedBy data also updates the respective forming data', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(shmTransposals))
    // X103 formedBy updated to X100
    // Original forming of X102 needs to update forming
    // X100 formeding also needs to be updated
    let changes = [{
      operationDays: "20250713",
      runID: "X103",
      formedBy: "X100"
    }]

    let updatedTrips = [await updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([
      'X100', 'X102'
    ])
  })

  it.only('Does not require an update if the values are already correct', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(shmTransposals))
    await timetables.updateDocument({ runID: "X103" }, { $set: { formedBy: 'X100' } })
    await timetables.updateDocument({ runID: "X101" }, { $set: { formedBy: 'X099' } })

    // X100 forming updated to X103
    // Both trips already have their formedBy changed from X100 so no update needed
    let changes = [{
      operationDays: "20250713",
      runID: "X100",
      forming: "X103"
    }]

    let updatedTrips = [await updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([])
  })
})