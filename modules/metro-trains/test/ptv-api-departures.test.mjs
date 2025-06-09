import { expect } from 'chai'
import ptvRWD from '../../new-tracker/test/sample-data/rwd-ptv-departures.json' with { type: 'json' }
import rwdStop from '../../new-tracker/test/sample-data/rwd-stop-db.json' with { type: 'json' }
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import getTripUpdateData from '../get-ptv-departures.js'
import { LokiDatabaseConnection } from '@transportme/database'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The getTripUpdateData function', () => {
  it('Should return trip data in the format used by the trip updater', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocument(clone(rwdStop))
    await routes.createDocuments([{
      "mode" : "metro train",
      "routeName" : "Lilydale",
      "cleanName" : "lilydale",
      "routeNumber" : null,
      "routeGTFSID" : "2-LIL",
      "operators" : [
        "Metro"
      ],
      "codedName" : "lilydale"
    }, {
      "mode" : "metro train",
      "routeName" : "Belgrave",
      "cleanName" : "belgrave",
      "routeNumber" : null,
      "routeGTFSID" : "2-BEG",
      "operators" : [
        "Metro"
      ],
      "codedName" : "belgrave"
    }])
    
    let stubAPI = new StubAPI()
    let response = clone(ptvRWD)
    response.departures = [ response.departures[0] ]
    stubAPI.setResponses([ response ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData(rwdStop, ptvAPI)

    expect(tripData[0].operationDays).to.equal('20250610')
    expect(tripData[0].runID).to.equal('3826')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].formedBy).to.be.undefined
    expect(tripData[0].forming).to.equal('3511')

    expect(tripData.stops.length).to.equal(1)
    expect(tripData.stops[0]).to.deep.equal({
      stopName: 'Ringwood Railway Station',
      platform: '2',
      scheduledDepartureTime: new Date('2025-06-09T22:07:00.000Z'),
      estimatedDepartureTime: new Date('2025-06-09T22:07:43.000Z'),
      cancelled: false
    })
  })
})