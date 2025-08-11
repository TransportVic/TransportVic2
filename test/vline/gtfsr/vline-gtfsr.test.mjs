import { LokiDatabaseConnection } from '@transportme/database'
import { getUpcomingTrips } from '../../../modules/new-tracker/vline/vline-gtfsr-trips.mjs'
import trnStops from './sample-data/trn-stops.mjs'
import td8403GTFSR from './sample-data/td8403-gtfsr.mjs'
import pkmStopsDB from '../../metro/tracker/sample-data/pkm-stops-db.json' with { type: 'json' }

const clone = o => JSON.parse(JSON.stringify(o))

describe('The V/Line GTFS-R updater', () => {
  it.only('Handles the first stop being cancelled', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    await stops.createDocument(clone(pkmStopsDB))
    await stops.createDocument(clone(trnStops))

    let data = await getUpcomingTrips(database, () => td8403GTFSR)
    expect(data.stops[0].stopName).to.equal('East Pakenham Railway Station')
  })
})