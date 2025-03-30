import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import stubSTYOpData from './sample-data/stony-point.json' with { type: 'json' }
import utils from '../../../utils.js'
import { getUpcomingTrips } from '../metro-trips.mjs'

describe('The getUpcomingTrips function', () => {
  it('Should only return runs from today or later', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-29T20:45:00.000Z') // current day is 30 march

    let stubAPI = new StubAPI()
    stubAPI.setResponses([ stubSTYOpData ])
    stubAPI.skipErrors()

    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addMetroSite(stubAPI)

    let trips = await getUpcomingTrips(ptvAPI, ptvAPI.metroSite.lines.STONY_POINT)

    expect(trips.some(trip => trip.operationalDate === '20250330')).to.be.true

    utils.now = originalNow
  })

  it('Should filter trips from the past', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-04-03T20:45:00.000Z') // current day is in april

    let stubAPI = new StubAPI()
    stubAPI.setResponses([ stubSTYOpData ])
    stubAPI.skipErrors()

    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addMetroSite(stubAPI)

    let trips = await getUpcomingTrips(ptvAPI, ptvAPI.metroSite.lines.STONY_POINT)

    expect(trips.some(trip => trip.operationalDate === '20250330')).to.be.false

    utils.now = originalNow
  })
})
