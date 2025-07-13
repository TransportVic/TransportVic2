import { LokiDatabaseConnection } from '@transportme/database'
import dbStops from '../../metro/test/sample-data/pkm-stops-db.json' with { type: 'json' }
import dbTrips from './sample-data/trip.json' with { type: 'json' }
import updates from './sample-data/rt-updates.json' with { type: 'json' }
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { getRailBusUpdates } from '../load-rt-updates.mjs'
import { expect } from 'chai'
import getTripID from '../get-trip-id.mjs'
import utils from '../../../../utils.js'

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
  let originalNow
  before(() => {
    originalNow = utils.now
    utils.now = () => utils.parseTime(1751954847 * 1000)
  })

  it('Should create a trip updater object', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let timetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(dbStops))
    await timetables.createDocument(clone(dbTrips))

    let tripData = await getRailBusUpdates(database, createAPI())
    expect(tripData[0].runID).to.equal(getTripID('Mon - Tue_qo16765'))
    expect(tripData[0].routeGTFSID).to.equal('2-RRB')
    expect(tripData[0].stops[0].stopName).to.equal('Carnegie Railway Station')
    expect(tripData[0].stops[0].estimatedArrivalTime.toISOString()).to.equal('2025-07-08T06:07:24.000Z')
    expect(tripData[0].stops[0].estimatedDepartureTime.toISOString()).to.equal('2025-07-08T06:07:24.000Z')
  })

  after(() => {
    utils.now = originalNow
  })
})