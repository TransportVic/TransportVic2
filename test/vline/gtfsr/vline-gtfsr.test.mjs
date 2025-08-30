import { LokiDatabaseConnection } from '@transportme/database'
import { fetchTrips, getUpcomingTrips } from '../../../modules/new-tracker/vline/vline-gtfsr-trips.mjs'
import trnStops from './sample-data/trn-stops.mjs'
import td8403GTFSR from './sample-data/td8403-gtfsr.mjs'
import pkmStopsDB from '../../metro/tracker/sample-data/pkm-stops-db.json' with { type: 'json' }
import { expect } from 'chai'
import td8403Live from './sample-data/td8403-live.mjs'
import ephTrips from '../../metro/utils/sample-data/eph-trips.mjs'
import td8409GTFSR from './sample-data/td8409-gtfsr.mjs'
import tdMismatch from './sample-data/td-mismatch.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

const td8403GTFSR_NNG_TYN = clone(td8403GTFSR)
td8403GTFSR_NNG_TYN.entity[0].trip_update.stop_time_update[0].stop_id = 'G1545-P2'
td8403GTFSR_NNG_TYN.entity[0].trip_update.stop_time_update.splice(1, 1)

const td8403Live_NNG_TYN = {
  ...clone(td8403Live),
  stopTimings: clone(td8403Live.stopTimings.slice(1)),
  origin: 'Nar Nar Goon Railway Station',
  departureTime: '09:18',
}

describe('The V/Line GTFS-R updater', () => {
  it('Handles the first stop being cancelled', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    await stops.createDocuments(clone(pkmStopsDB))
    await stops.createDocuments(clone(trnStops))

    let tripUpdates = await getUpcomingTrips(database, () => td8403GTFSR_NNG_TYN)
    expect(tripUpdates[0].stops[0].stopName).to.equal('Nar Nar Goon Railway Station')
    expect(tripUpdates[0].scheduledStartTime).to.not.exist
  })

  it('Handles the cancellation correctly', async () => {
    let database = new LokiDatabaseConnection()
    let timetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')
    await stops.createDocuments(clone(pkmStopsDB))
    await stops.createDocuments(clone(trnStops))
    await timetables.createDocument(clone(td8403Live_NNG_TYN))

    await fetchTrips(database, () => td8403GTFSR_NNG_TYN)

    let trip = await timetables.findDocument({})
    expect(trip.stopTimings[0].stopName).to.equal('Nar Nar Goon Railway Station')
    expect(trip.stopTimings[0].cancelled).to.be.true

    expect(trip.stopTimings[1].stopName).to.equal('Tynong Railway Station')
    expect(trip.stopTimings[1].platform).to.equal('2')
  })

  it('Ensures EPH does not get cancelled on altered working trains', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    await stops.createDocuments(clone(pkmStopsDB))
    await stops.createDocuments(clone(trnStops))

    let tripUpdates = await getUpcomingTrips(database, () => td8403GTFSR)

    expect(tripUpdates[0].stops[0].stopName).to.equal('East Pakenham Railway Station')
    expect(tripUpdates[0].stops[0].cancelled).to.be.false
    expect(tripUpdates[0].scheduledStartTime).to.not.exist
  })

  it('Checks for EPH platform availability', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let timetables = database.getCollection('live timetables')
    await stops.createDocuments(clone(pkmStopsDB))
    await stops.createDocuments(clone(trnStops))
    await timetables.createDocuments(clone(ephTrips))

    let tripUpdates = await getUpcomingTrips(database, () => td8409GTFSR)

    expect(tripUpdates[0].stops[0].stopName).to.equal('East Pakenham Railway Station')
    expect(tripUpdates[0].stops[0].platform).to.equal('1')
  })

  it('Filters trips with a TDN mismatch', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    await stops.createDocuments(clone(pkmStopsDB))
    await stops.createDocuments(clone(trnStops))

    let tripUpdates = await getUpcomingTrips(database, () => tdMismatch)
    expect(tripUpdates[0].runID).to.equal('8417')
  })
})