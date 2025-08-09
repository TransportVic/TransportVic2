import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import shmTransposals from './sample-data/shm-transposals.json' with { type: 'json' }
import blyTransposals from './sample-data/bly-transposals.json' with { type: 'json' }
import ccl1951_7138 from './sample-data/ccl-1951-7138.json' with { type: 'json' }
import ptvAPI1951 from './sample-data/ptv-api-1951.json' with { type: 'json' }
import pkmStopsDB from './sample-data/pkm-stops-db.json' with { type: 'json' }
import blyStops from './sample-data/bbn-stops-db.json' with { type: 'json' }
import MetroTripUpdater from '../../../modules/metro-trains/trip-updater.mjs'
import { getTripsRequiringUpdates, updateRelatedTrips } from '../../../modules/new-tracker/metro/check-new-updates.mjs'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The changelog tracker', () => {
  it('Ensures updates to forming data also updates the respective formedBy data', async () => {
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

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([
      'X101', 'X103'
    ])
  })

  it('Ensures updates to formedBy data also updates the respective forming data', async () => {
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

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([
      'X100', 'X102'
    ])
  })

  it('Does not require an update if the values are already correct', async () => {
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

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([])
  })

  it('Excludes specified trips', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(shmTransposals))
    let changes = [{
      operationDays: "20250713",
      runID: "X103",
      formedBy: "X100"
    }]

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips, ['X100', 'X102'])
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.members([])
  })

  it('Deduplicates trips if both its formedBy/forming have updates', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(shmTransposals))
    await timetables.updateDocument({ runID: "X101" }, { $set: { formedBy: 'X100', forming: 'X102' } })
    await timetables.updateDocument({ runID: "X102" }, { $set: { formedBy: 'X101' } })

    let changes = [{
      operationDays: "20250713",
      runID: "X100",
      forming: "X999"
    }, {
      operationDays: "20250713",
      runID: "X102",
      formedBy: "X999"
    }]

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0]), await MetroTripUpdater.updateTrip(db, changes[1])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate.map(trip => trip.runID)).to.have.deep.equal([
      'X101',
      'X999' // Note: It detects a new trip not in the DB so it forces this to be loaded in
    ])
  })

  it('Sets the forming to null in a transposal involving an empty cars run', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let stops = await db.createCollection('stops')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(blyTransposals.dbTrips))
    await stops.createDocuments(clone(blyStops))

    let stubAPI = new StubAPI()
    stubAPI.setResponses([ clone(blyTransposals.ptvAPI) ])
    stubAPI.skipErrors()
    let ptvAPI = new PTVAPI(stubAPI)

    // 2054 transposed to form 3437
    // 3638 transposed to form the ETY move (not reflected so should be forming null)
    let changes = [{
      operationDays: "20250716",
      runID: "2054",
      forming: "3437"
    }, {
      operationDays: "20250716",
      runID: "3437",
      formedBy: "2054"
    }, {
      operationDays: "20250716",
      runID: "3638",
      stops: [{
        stopName: "Flinders Street Railway Station",
        platform: '4'
      }]
    }]

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0]), await MetroTripUpdater.updateTrip(db, changes[1]), await MetroTripUpdater.updateTrip(db, changes[2])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate).to.deep.equal([{
      operationDays: '20250716',
      runID: '3638',
      setNull: 'forming',
      badVal: '3437'
    }])

    await updateRelatedTrips(db, updatedTrips, ptvAPI)
    let new3638 = await timetables.findDocument({ runID: "3638" })
    expect(new3638.forming).to.be.null
  })

  it('Ensures the forming data is set even when the PTV API returns null on one half of the trip', async () => {
    let db = new LokiDatabaseConnection('test-db')
    let stops = await db.createCollection('stops')
    let timetables = await db.createCollection('live timetables')
    await timetables.createDocuments(clone(ccl1951_7138))
    await stops.createDocuments(clone(pkmStopsDB))

    let stubAPI = new StubAPI()
    stubAPI.setResponses([ clone(ptvAPI1951) ])
    stubAPI.skipErrors()
    let ptvAPI = new PTVAPI(stubAPI)

    // 7138 updated to be formed by 1951
    let changes = [{
      operationDays: "20250718",
      runID: "7138",
      formedBy: "1951"
    }]

    let updatedTrips = [await MetroTripUpdater.updateTrip(db, changes[0])]
    let tripsNeedingUpdate = await getTripsRequiringUpdates(timetables, updatedTrips)
    expect(tripsNeedingUpdate).to.deep.equal([{
      operationDays: '20250718',
      runID: '1951',
      enforceField: 'forming',
      enforceValue: '7138'
    }])

    await updateRelatedTrips(db, updatedTrips, ptvAPI)
    let new1951 = await timetables.findDocument({ runID: "1951" })
    expect(new1951.forming).to.equal('7138')
  })
})