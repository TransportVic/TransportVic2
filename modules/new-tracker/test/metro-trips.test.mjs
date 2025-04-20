import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import styLiveTrips from './sample-data/sty-trips.json' with { type: 'json' }
import styStops from './sample-data/sty-stops.json' with { type: 'json' }
import styRoute from './sample-data/sty-route.json' with { type: 'json' }
import stubSTYOpData from './sample-data/stony-point.json' with { type: 'json' }
import utils from '../../../utils.js'
import { fetchTrips, getUpcomingTrips } from '../metro-trips.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI() {
  let stubAPI = new StubAPI()
  stubAPI.setResponses([ stubSTYOpData ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

describe('The getUpcomingTrips function', () => {
  it('Should only return runs from today or later', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-29T20:45:00.000Z') // current day is 30 march

    let ptvAPI = createAPI()

    let trips = await getUpcomingTrips(ptvAPI, ptvAPI.metroSite.lines.STONY_POINT)

    expect(trips.some(trip => trip.operationalDate === '20250330')).to.be.true

    utils.now = originalNow
  })

  it('Should filter trips from the past', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-04-03T20:45:00.000Z') // current day is in april

    let ptvAPI = createAPI()

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

    let stops = await db.createCollection('stops')
    await stops.createDocuments(clone(styStops))

    let routes = await db.createCollection('routes')
    await routes.createDocument(clone(styRoute))

    let ptvAPI = createAPI()

    await fetchTrips(ptvAPI, db, ptvAPI.metroSite.lines.STONY_POINT)

    let td8500 = await liveTimetables.findDocument({ runID: '8500' })
    expect(td8500.formedBy).to.equal('8501')
    expect(td8500.forming).to.equal('8503')

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

    let ptvAPI = createAPI()

    await fetchTrips(ptvAPI, db, ptvAPI.metroSite.lines.STONY_POINT)

    let td8506 = await liveTimetables.findDocument({ runID: '8506' })
    expect(td8506.origin).to.equal('Stony Point Railway Station')
    expect(td8506.departureTime).to.equal('14:09')
    expect(td8506.destination).to.equal('Frankston Railway Station')
    expect(td8506.destinationArrivalTime).to.equal('14:45')

    utils.now = originalNow
  })
})
