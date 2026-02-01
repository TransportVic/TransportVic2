import { LokiDatabaseConnection } from '@transportme/database'
import dbStops from '../tracker/sample-data/pkm-stops-db.json' with { type: 'json' }
import dbTrip1 from './sample-data/trip.json' with { type: 'json' }
import updates from './sample-data/rt-updates.json' with { type: 'json' }

import asp from './sample-data/asp.json' with { type: 'json' }
import dbTrip2 from './sample-data/trip2.json' with { type: 'json' }
import updates2 from './sample-data/rt-updates2.json' with { type: 'json' }

import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { fetchTrips, getRailBusUpdates } from '../../../modules/new-tracker/metro-rail-bus/load-rt-updates.mjs'
import { expect } from 'chai'
import getTripID from '../../../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'
import utils from '../../../utils.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI(data) {
  let stubAPI = new StubAPI()
  stubAPI.setResponses([ data ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

describe('The MTM Rail Bus Tracker', () => {
  let originalNow
  before(() => {
    originalNow = utils.now
  })

  it('Should create a trip updater object', async () => {
    utils.now = () => utils.parseTime(1751954847 * 1000)

    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let timetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(dbStops))
    await timetables.createDocument(clone(dbTrip1))

    let tripData = await getRailBusUpdates(database, createAPI(updates))
    expect(tripData[0].runID).to.equal(getTripID('Mon - Tue_qo16765'))
    expect(tripData[0].routeGTFSID).to.equal('2-RRB')
    expect(tripData[0].stops[0].stopName).to.equal('Carnegie Railway Station')
    expect(tripData[0].stops[0].estimatedArrivalTime.toISOString()).to.equal('2025-07-08T06:07:24.000Z')
    expect(tripData[0].stops[0].estimatedDepartureTime.toISOString()).to.equal('2025-07-08T06:07:24.000Z')
  })

  it('Updates the trip data accordingly', async () => {
    utils.now = () => utils.parseTime(1752985123 * 1000)
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let timetables = await database.createCollection('live timetables')

    await stops.createDocument(clone(asp))
    await timetables.createDocument(clone(dbTrip2))

    let tripData = await fetchTrips(database, database, createAPI(updates2))
    expect(tripData[0].runID).to.equal(getTripID('Sun_kgmfdtw'))
    expect(tripData[0].routeGTFSID).to.equal('2-RRB')
    expect(tripData[0].direction).to.equal('Up')
    expect(tripData[0].stops[0].stopName).to.equal('Carrum Railway Station')

    expect(tripData[0].stops[4].stopName).to.equal('Aspendale Railway Station')
    expect(tripData[0].stops[4].estimatedDepartureTime.toISOString()).to.equal('2025-07-20T04:25:44.000Z')
  })

  after(() => {
    utils.now = originalNow
  })
})