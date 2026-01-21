import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import styLiveTrips from './sample-data/sty-trips.json' with { type: 'json' }
import styStops from './sample-data/sty-stops.json' with { type: 'json' }
import bbnStops from './sample-data/bbn-stops-db.json' with { type: 'json' }
import styRoute from './sample-data/sty-route.json' with { type: 'json' }
import stubSTYOpData from './sample-data/stony-point.json' with { type: 'json' }
import utils from '../../../utils.mjs'
import { fetchTrips, getUpcomingTrips } from '../../../modules/new-tracker/metro/metro-trips-schedule.mjs'
import td3154DST from './sample-data/td3154-dst.mjs'
import begRoute from './sample-data/beg-route.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI(stubTT) {
  let stubAPI = new StubAPI()
  stubAPI.setResponses([ stubTT ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

describe('The getUpcomingTrips function', () => {
  it('Should only return runs from today or later', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-29T20:45:00.000Z') // current day is 30 march

    let ptvAPI = createAPI(stubSTYOpData)

    let trips = await getUpcomingTrips(ptvAPI, ptvAPI.metroSite.lines.STONY_POINT)

    expect(trips.some(trip => trip.operationalDate === '20250330')).to.be.true

    utils.now = originalNow
  })

  it('Should filter trips from the past', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-04-03T20:45:00.000Z') // current day is in april

    let ptvAPI = createAPI(stubSTYOpData)

    let trips = await getUpcomingTrips(ptvAPI, ptvAPI.metroSite.lines.STONY_POINT)

    expect(trips.some(trip => trip.operationalDate === '20250330')).to.be.false

    utils.now = originalNow
  })

  it('Should update the trip data of existing live trips', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseDate('20250330')
    
    let db = new LokiDatabaseConnection()
    db.connect()
    let liveTimetables = await db.createCollection('live timetables')
    await liveTimetables.createDocuments(clone(styLiveTrips))

    let td9999 = clone(styLiveTrips.find(trip => trip.runID === '8504'))
    td9999.runID = '9999'
    td9999.forming = '8503'
    await liveTimetables.createDocument(td9999)

    let stops = await db.createCollection('stops')
    await stops.createDocuments(clone(styStops))

    let routes = await db.createCollection('routes')
    await routes.createDocument(clone(styRoute))

    let ptvAPI = createAPI(stubSTYOpData)

    await fetchTrips(ptvAPI, db, db, ptvAPI.metroSite.lines.STONY_POINT)

    let td8500 = await liveTimetables.findDocument({ runID: '8500' })
    expect(td8500.formedBy).to.equal('8501')
    expect(td8500.forming).to.equal('8503')

    expect(td8500.stopTimings[0].estimatedDepartureTime).to.be.null

    let td8503 = await liveTimetables.findDocument({ runID: '8503' })
    expect(td8503.formedBy).to.equal('8500')
    expect(td8503.forming).to.equal('8502')

    let td8505 = await liveTimetables.findDocument({ runID: '8505' })
    expect(td8505.formedBy).to.equal('8502')
    expect(td8505.forming).to.equal('8504')

    td9999 = await liveTimetables.findDocument({ runID: '9999' })
    expect(td9999.forming).to.be.null

    utils.now = originalNow
  })

  it('Should insert any missed trips', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseDate('20250330')
    
    let db = new LokiDatabaseConnection()
    db.connect()
    let liveTimetables = await db.createCollection('live timetables')
    await liveTimetables.createDocuments(clone(styLiveTrips))

    let stops = await db.createCollection('stops')
    await stops.createDocuments(clone(styStops))

    let routes = await db.createCollection('routes')
    await routes.createDocument(clone(styRoute))

    let ptvAPI = createAPI(stubSTYOpData)

    await fetchTrips(ptvAPI, db, db, ptvAPI.metroSite.lines.STONY_POINT)

    let td8506 = await liveTimetables.findDocument({ runID: '8506' })
    expect(td8506.origin).to.equal('Stony Point Railway Station')
    expect(td8506.departureTime).to.equal('14:09')
    expect(td8506.destination).to.equal('Frankston Railway Station')
    expect(td8506.destinationArrivalTime).to.equal('14:45')

    expect(td8506.stopTimings[0].estimatedDepartureTime).to.be.null

    utils.now = originalNow
  })

  it('Accounts for the start of daylight saving (skipping 2am) on the Sunday', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseDate('20251005')

    let db = new LokiDatabaseConnection()
    let liveTimetables = await db.createCollection('live timetables')

    let stops = await db.createCollection('stops')
    await stops.createDocuments(clone(bbnStops))

    let routes = await db.createCollection('routes')
    await routes.createDocument(clone(begRoute))

    let ptvAPI = createAPI(td3154DST)

    await fetchTrips(ptvAPI, db, db, ptvAPI.metroSite.lines.BELGRAVE)

    let td3154 = await liveTimetables.findDocument({ runID: '3154' })
    expect(td3154.origin).to.equal('Belgrave Railway Station')
    expect(td3154.departureTime).to.equal('03:40')
    expect(td3154.destination).to.equal('Ringwood Railway Station')
    expect(td3154.destinationArrivalTime).to.equal('04:04')

    utils.now = originalNow
  })
})
