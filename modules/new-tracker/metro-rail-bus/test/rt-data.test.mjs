import { LokiDatabaseConnection } from '@transportme/database'
import dbStops from './sample-data/stops.json' with { type: 'json' }
import dbTrips from './sample-data/trips.json' with { type: 'json' }
import updates from './sample-data/rt-updates.json' with { type: 'json' }
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { getRailBusUpdates } from '../load-rt-updates.mjs'
import { expect } from 'chai'
import { updateTrip } from '../../../metro-trains/trip-updater.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI() {
  let stubAPI = new StubAPI()
  stubAPI.setResponses([ updates ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

describe('The MTM Rail Bus Tracker', () => {
  it('Should create a trip updater object', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    await stops.createDocuments(clone(dbStops))

    let tripData = await getRailBusUpdates(database, createAPI())

    expect(tripData[0].tripID).to.equal('Mon - Tue_qo16765')
    expect(tripData[0].routeGTFSID).to.equal('2-RRB')
    expect(tripData[0].stops[0].stopName).to.equal('Carnegie Railway Station')
    expect(tripData[0].stops[0].estimatedArrivalTime).to.equal('2025-07-08T06:04:27.000Z')
    expect(tripData[0].stops[0].estimatedDepartureTime).to.equal('2025-07-08T06:04:27.000Z')
  })
})