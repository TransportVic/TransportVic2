import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import notifyAlerts from './sample-data/notify-alert.json' with { type: 'json' }
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { fetchNotifyAlerts } from '../metro-notify.mjs'
import { getUpdatedTDNs } from '../metro-notify-trips.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI(response) {
  let stubAPI = new StubAPI()
  stubAPI.setResponses(response || [ notifyAlerts ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

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
})