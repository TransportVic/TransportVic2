import { expect } from 'chai'
import ptvRWD from '../../new-tracker/test/sample-data/rwd-ptv-departures.json' with { type: 'json' }
import rwdStop from '../../new-tracker/test/sample-data/rwd-stop-db.json' with { type: 'json' }
import TD3826DBTrip from '../../new-tracker/test/sample-data/lil-3826.json' with { type: 'json' }
import ptvAPITD3213 from '../../new-tracker/test/sample-data/ptv-api-3213.json' with { type: 'json' }
import ptvAPITD3826 from '../../new-tracker/test/sample-data/ptv-api-3826.json' with { type: 'json' }
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
    await liveTimetables.createDocument(clone(TD3826DBTrip))
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

    let tripData = await getTripUpdateData(database, rwdStop, ptvAPI)

    expect(tripData[0].operationDays).to.equal('20250610')
    expect(tripData[0].runID).to.equal('3826')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].formedBy).to.be.undefined
    expect(tripData[0].forming).to.equal('3511')

    expect(tripData[0].stops.length).to.equal(1)
    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'Ringwood Railway Station',
      platform: '2',
      estimatedDepartureTime: new Date('2025-06-09T22:07:43.000Z'),
      cancelled: false
    })

    expect(tripData[0].consist).to.deep.equal([['913M', '1657T', '914M'], ['949M', '1675T', '950M']])
  })

  it('Should fetch stopping pattern data for unmatched trips in the database', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocument(clone(rwdStop))
    await liveTimetables.createDocument(clone(TD3826DBTrip))
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
    response.departures = [ response.departures[1] ]
    stubAPI.setResponses([ response, clone(ptvAPITD3213) ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData(database, rwdStop, ptvAPI)

    expect(tripData[0].operationDays).to.equal('20250610')
    expect(tripData[0].runID).to.equal('3213')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].formedBy).to.equal('2806')
    expect(tripData[0].forming).to.equal('3832')

    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'Flinders Street Railway Station',
      platform: '3',
      scheduledDepartureTime: new Date('2025-06-10T07:29:00.000+10:00'),
      estimatedDepartureTime: new Date('2025-06-10T07:28:40.000+10:00'),
      cancelled: false
    })

    expect(tripData[0].stops[tripData[0].stops.length - 2]).to.deep.equal({
      stopName: 'Mooroolbark Railway Station',
      platform: '2',
      scheduledDepartureTime: new Date('2025-06-10T08:22:00.000+10:00'),
      estimatedDepartureTime: new Date('2025-06-10T08:24:00.000+10:00'),
      cancelled: false
    })

    expect(tripData[0].stops[tripData[0].stops.length - 1]).to.deep.equal({
      stopName: 'Lilydale Railway Station',
      platform: '1',
      scheduledDepartureTime: new Date('2025-06-10T08:28:00.000+10:00'),
      cancelled: false
    })
  })

  it('Should fetch stopping pattern data for updated trips', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocument(clone(rwdStop))
    await liveTimetables.createDocument(clone(TD3826DBTrip))
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
    response.runs[response.departures[0].run_ref].status = 'updated'
    stubAPI.setResponses([ response, clone(ptvAPITD3826) ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData(database, rwdStop, ptvAPI)

    expect(tripData[0].operationDays).to.equal('20250610')
    expect(tripData[0].runID).to.equal('3826')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'Lilydale Railway Station',
      platform: '1',
      scheduledDepartureTime: new Date('2025-06-10T07:50:00.000+10:00'),
      estimatedDepartureTime: new Date('2025-06-10T07:49:40.000+10:00'),
      cancelled: false
    })

    expect(tripData[0].stops[tripData[0].stops.length - 1]).to.deep.equal({
      stopName: 'Flinders Street Railway Station',
      platform: '2',
      scheduledDepartureTime: new Date('2025-06-09T22:58:00.000Z'),
      cancelled: false
    })
  })
})