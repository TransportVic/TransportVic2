import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { LokiDatabaseConnection } from '@transportme/database'
import allStops from '../op-tt/sample-data/stops.json' with { type: 'json' }
import td8866 from './sample-data/td8866.json' with { type: 'json' }
import td8741GTFS from '../op-tt/sample-data/td8741-gtfs.json' with { type: 'json' }
import { fetchSSSPlatforms, getPlatformUpdates } from '../../../modules/new-tracker/vline/southern-cross-platform.mjs'
import convertToLive from '../../../modules/departures/sch-to-live.mjs'
import td8431Live from '../gtfsr/sample-data/td8431-live.mjs'
import trnStops from '../gtfsr/sample-data/trn-stops.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sssPlatformsArr = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8866-arr.xml'))).toString()
const sssPlatformsDep = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8741-dep.xml'))).toString()

const sssPlatform15 = (await fs.readFile(path.join(__dirname, 'sample-data', 'sss-plat-8431-15a.xml'))).toString()
const emptyPlatform = (await fs.readFile(path.join(__dirname, '..', 'op-tt', 'sample-data', 'vline-trips-empty.xml'))).toString()

const clone = o => JSON.parse(JSON.stringify(o))
const td8741 = convertToLive(clone(td8741GTFS), '20250718')
td8741.runID = '8741'

describe('The SSS Platform updater', () => {
  it('Fetches the list of arrivals into SSS and produces trip update objects', async () => {
    let database = new LokiDatabaseConnection()
    let liveTimetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')

    await liveTimetables.createDocuments([ clone(td8866), clone(td8741) ])
    await stops.createDocuments(clone(allStops))

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

    await liveTimetables.createDocuments([ clone(td8866), clone(td8741) ])
    await stops.createDocuments(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ sssPlatformsArr, sssPlatformsDep ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    const trips = {}
    await fetchSSSPlatforms('20250718', database, database, ptvAPI, trips)

    let td8866Trip = trips['20250718-8866'].toDatabase()
    expect(td8866Trip.stopTimings[0].cancelled).to.be.false
    expect(td8866Trip.stopTimings[0].stopName).to.equal('Warrnambool Railway Station')

    expect(td8866Trip.stopTimings[td8866Trip.stopTimings.length - 1].stopName).to.equal('Southern Cross Railway Station')
    expect(td8866Trip.stopTimings[td8866Trip.stopTimings.length - 1].cancelled).to.be.false
    expect(td8866Trip.stopTimings[td8866Trip.stopTimings.length - 1].platform).to.equal('8')

    let td8741Trip = trips['20250718-8741'].toDatabase()
    expect(td8741Trip.stopTimings[0].cancelled).to.be.false
    expect(td8741Trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(td8741Trip.stopTimings[0].platform).to.equal('1')

    expect(td8741Trip.stopTimings[td8741Trip.stopTimings.length - 1].stopName).to.equal('Waurn Ponds Railway Station')
    expect(td8741Trip.stopTimings[td8741Trip.stopTimings.length - 1].cancelled).to.be.false
    expect(td8741Trip.stopTimings[td8741Trip.stopTimings.length - 1].platform).to.not.exist
  })

  it('Does not unset platform 15/16A/B at SSS if a more specific platform is available', async () => {
    let database = new LokiDatabaseConnection()
    let liveTimetables = database.getCollection('live timetables')
    let stops = database.getCollection('stops')
    await liveTimetables.createDocument(clone(td8431Live))
    await stops.createDocuments(clone(trnStops))
    await stops.createDocuments(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ sssPlatform15, emptyPlatform ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)


    const trips = {}
    await fetchSSSPlatforms('20250914', database, database, ptvAPI, trips)

    let td8431Trip = trips['20250914-8431'].toDatabase()

    expect(td8431Trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(td8431Trip.stopTimings[0].platform).to.equal('15A')
  })
})