import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { fetchTrips, getUpdatedTDNs } from '../../../modules/new-tracker/metro/metro-notify-trips.mjs'

describe('The MetroNotify trip tracker', () => {
  it('Should get TDNs for trips with an alert issued in the last 5 minutes', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let metroNotify = await database.createCollection('metro notify')

    await metroNotify.createDocument({
      alertID: '123',
      rawAlertID: '123',
      routeName: 'Lilydale',
      fromDate: +(new Date() / 1000) - 60, // 1 min ago
      toDate: +(new Date() / 1000) + 60 * 5, // 5 min from now 
      type: 'service',
      text: 'Test text',
      runID: '3123',
      active: true
    })

    await metroNotify.createDocument({
      alertID: '122',
      rawAlertID: '122',
      routeName: 'Lilydale',
      fromDate: +(new Date() / 1000) - 60 * 6, // 6 min ago
      toDate: +(new Date() / 1000) + 60 * 5, // 5 min from now 
      type: 'service',
      text: 'Test text',
      runID: '3124',
      active: true
    })

    await metroNotify.createDocument({
      alertID: '1234',
      rawAlertID: '1234',
      routeName: 'Pakenham',
      fromDate: +(new Date() / 1000) - 60, // 1 min ago
      toDate: +(new Date() / 1000) + 60 * 5, // 5 min from now 
      type: 'minor',
      text: 'Test text',
      active: true
    })

    expect(await getUpdatedTDNs(database)).to.deep.equal(['3123'])
  })

  it('Fetch updates for TDNs with an alert issued', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let metroNotify = await database.createCollection('metro notify')
    let stubAPI = new StubAPI()
    stubAPI.setResponses([])
    stubAPI.skipErrors()
    let ptvAPI = new PTVAPI(stubAPI)

    await metroNotify.createDocument({
      alertID: '123',
      rawAlertID: '123',
      routeName: 'Lilydale',
      fromDate: +(new Date() / 1000) - 60, // 1 min ago
      toDate: +(new Date() / 1000) + 60 * 5, // 5 min from now 
      type: 'service',
      text: 'Test text',
      runID: '3123',
      active: true
    })

    try {
      await fetchTrips(database, ptvAPI)
    } catch (e) {}

    expect(stubAPI.getCalls()[0]).to.exist
    expect(stubAPI.getCalls()[0].path).to.contain('/v3/pattern/run/951123')
  })
})