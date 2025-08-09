import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import stubDepartures from './sample-data/mtm-departures.json' with { type: 'json' }
import { getDepartures } from '../../../modules/new-tracker/metro/metro-trips-departures.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI() {
  let stubAPI = new StubAPI()
  stubAPI.setResponses([ stubDepartures ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

describe('The getDepartures function', () => {
  it('Should return trip updater data', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let routes = await database.createCollection('routes')

    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Mernda",
      "cleanName" : "mernda",
      "routeNumber" : null,
      "routeGTFSID" : "2-MDD",
      "operators" : [
        "Metro"
      ],
      "cleanName" : "mernda"
    })

    let ptvAPI = createAPI()

    let tripData = await getDepartures(database, ptvAPI)

    expect(tripData[0].operationDays).to.equal('20250609')
    expect(tripData[0].runID).to.equal('1092')
    expect(tripData[0].routeGTFSID).to.equal('2-MDD')

    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'Regent Railway Station',
      platform: '1',
      scheduledDepartureTime: new Date('2025-06-09T11:42:00.000Z'),
      estimatedArrivalTime: new Date('2025-06-09T11:42:00.000Z'),
      estimatedDepartureTime: new Date('2025-06-09T11:42:00.000Z')
    })

    expect(tripData[0].stops[1]).to.deep.equal({
      stopName: 'Preston Railway Station',
      platform: '1',
      scheduledDepartureTime: new Date('2025-06-09T11:44:00.000Z'),
      estimatedArrivalTime: new Date('2025-06-09T11:44:00.000Z'),
      estimatedDepartureTime: new Date('2025-06-09T11:44:00.000Z')
    })
  })
})
