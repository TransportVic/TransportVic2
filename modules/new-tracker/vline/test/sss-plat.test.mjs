import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { LokiDatabaseConnection } from '@transportme/database'
import allStops from '../../../op-timetable/test/sample-data/stops.json' with { type: 'json' }
import allRoutes from '../../../op-timetable/test/sample-data/routes.json' with { type: 'json' }
import td8866 from './sample-data/td8866.json' with { type: 'json' }
import { getPlatformUpdates } from '../southern-cross-platform.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sssPlatforms = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8866.xml'))).toString()

const clone = o => JSON.parse(JSON.stringify(o))

describe('The SSS Platform updater', () => {
  it.only('Fetches the list of arrivals into SSS and produces trip update objects', async () => {
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
      runID: '8877',
      stops: [{
        stopName: 'Southern Cross Railway Station',
        estimatedArrivalTime: new Date('2025-07-18T08:41:00Z'),
        platform: '3'
      }]
    })
  })
})