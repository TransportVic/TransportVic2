import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { LokiDatabaseConnection } from '@transportme/database'
import allStops from '../../../op-timetable/test/sample-data/stops.json' with { type: 'json' }
import allRoutes from '../../../op-timetable/test/sample-data/routes.json' with { type: 'json' }
import td8866 from './sample-data/td8866.json' with { type: 'json' }
import td8741GTFS from '../../../op-timetable/test/sample-data/td8741-gtfs.json' with { type: 'json' }
import { fetchTrips, getPlatformUpdates } from '../southern-cross-platform.mjs'
import { convertToLive } from '../../../departures/sch-to-live.js'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sssPlatformsArr = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8866-arr.xml'))).toString()
const sssPlatformsDep = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8741-dep.xml'))).toString()

const clone = o => JSON.parse(JSON.stringify(o))

describe('The SSS Platform updater', () => {
  it('Fetches the list of arrivals into SSS and produces trip update objects', async () => {
    let database = new LokiDatabaseConnection()
    let liveTimetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')

    await liveTimetables.createDocuments([ clone(td8866), convertToLive(clone(td8741GTFS)) ])
    await stops.createDocument(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ sssPlatformsArr, sssPlatformsDep ])
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

    expect(tripUpdates[1]).to.deep.equal({
      operationDays: '20250718',
      runID: '8741',
      stops: [{
        stopName: 'Southern Cross Railway Station',
        platform: '1'
      }]
    })
  })

  it('Updates the trip objects', async () => {
    let database = new LokiDatabaseConnection()
    let liveTimetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')

    await liveTimetables.createDocuments([ clone(td8866), convertToLive(clone(td8741GTFS)) ])
    await stops.createDocument(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ sssPlatformsArr, sssPlatformsDep ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await fetchTrips('20250718', database, ptvAPI)

    let td8866Trip = await liveTimetables.findDocument({ runID: '8866' })
    expect(td8866Trip.stopTimings[0].cancelled).to.be.false
    expect(td8866Trip.stopTimings[0].stopName).to.equal('Warrnambool Railway Station')

    expect(td8866Trip.stopTimings[td8866Trip.stopTimings.length - 1].stopName).to.equal('Southern Cross Railway Station')
    expect(td8866Trip.stopTimings[td8866Trip.stopTimings.length - 1].cancelled).to.be.false
    expect(td8866Trip.stopTimings[td8866Trip.stopTimings.length - 1].platform).to.equal('8')

    let td8741Trip = await liveTimetables.findDocument({ runID: '8741' })
    expect(td8741Trip.stopTimings[0].cancelled).to.be.false
    expect(td8741Trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(td8741Trip.stopTimings[0].platform).to.equal('1')

    expect(td8741Trip.stopTimings[td8741Trip.stopTimings.length - 1].stopName).to.equal('Waurn Ponds Railway Station')
    expect(td8741Trip.stopTimings[td8741Trip.stopTimings.length - 1].cancelled).to.be.false
    expect(td8741Trip.stopTimings[td8741Trip.stopTimings.length - 1].platform).to.not.exist
  })
})