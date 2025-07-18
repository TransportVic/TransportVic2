import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { LokiDatabaseConnection } from '@transportme/database'
import allStops from '../../../op-timetable/test/sample-data/stops.json' with { type: 'json' }
import allRoutes from '../../../op-timetable/test/sample-data/routes.json' with { type: 'json' }
import td8866 from './sample-data/td8866.json' with { type: 'json' }
import { fetchTrips, getPlatformUpdates } from '../southern-cross-platform.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sssPlatforms = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8866.xml'))).toString()

const clone = o => JSON.parse(JSON.stringify(o))

describe('The SSS Platform updater', () => {
  it('Fetches the list of arrivals into SSS and produces trip update objects', async () => {
    let database = new LokiDatabaseConnection()
    let liveTimetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')

    await liveTimetables.createDocument(clone(td8866))
    await stops.createDocument(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ sssPlatforms ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    let tripUpdates = await getPlatformUpdates('20250718', database, ptvAPI)
    expect(tripUpdates[0]).to.deep.equal({
      operationDays: '20250718',
      runID: '8866',
      stops: [{
        stopName: 'Southern Cross Railway Station',
        estimatedArrivalTime: new Date('2025-07-18T08:41:00Z'),
        platform: '8'
      }]
    })
  })

  it('Updates the trip objects', async () => {
    let database = new LokiDatabaseConnection()
    let liveTimetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')

    await liveTimetables.createDocument(clone(td8866))
    await stops.createDocument(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ sssPlatforms ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await fetchTrips('20250718', database, ptvAPI)

    let trip = await liveTimetables.findDocument({ runID: '8866' })
    expect(trip.stopTimings[0].cancelled).to.be.false
    expect(trip.stopTimings[0].stopName).to.equal('Warrnambool Railway Station')

    expect(trip.stopTimings[trip.stopTimings.length - 1].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[trip.stopTimings.length - 1].cancelled).to.be.false
    expect(trip.stopTimings[trip.stopTimings.length - 1].platform).to.equal('8')
  })
})