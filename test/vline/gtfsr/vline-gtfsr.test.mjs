import { LokiDatabaseConnection } from '@transportme/database'
import { fetchTrips, getUpcomingTrips } from '../../../modules/new-tracker/vline/vline-gtfsr-trips.mjs'
import trnStops from './sample-data/trn-stops.mjs'
import td8403GTFSR from './sample-data/td8403-gtfsr.mjs'
import pkmStopsDB from '../../metro/tracker/sample-data/pkm-stops-db.json' with { type: 'json' }
import { expect } from 'chai'
import td8403Live from './sample-data/td8403-live.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The V/Line GTFS-R updater', () => {
  it('Handles the first stop being cancelled', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    await stops.createDocument(clone(pkmStopsDB))
    await stops.createDocument(clone(trnStops))

    let tripUpdates = await getUpcomingTrips(database, () => td8403GTFSR)
    expect(tripUpdates[0].stops[0].stopName).to.equal('East Pakenham Railway Station')
    expect(tripUpdates[0].scheduledStartTime).to.not.exist
  })

  it('Handles the cancellation correctly', async () => {
    let database = new LokiDatabaseConnection()
    let timetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')
    await stops.createDocument(clone(pkmStopsDB))
    await stops.createDocument(clone(trnStops))
    await timetables.createDocument(clone(td8403Live))

    await fetchTrips(database, () => td8403GTFSR)

    let trip = await timetables.findDocument({})
    expect(trip.stopTimings[0].stopName).to.equal('East Pakenham Railway Station')
    expect(trip.stopTimings[0].cancelled).to.be.true

    expect(trip.stopTimings[1].stopName).to.equal('Nar Nar Goon Railway Station')
    expect(trip.stopTimings[1].platform).to.equal('2')
  })
})