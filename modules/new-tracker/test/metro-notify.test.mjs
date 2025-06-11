import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import notifyAlerts from './sample-data/notify-alert.json' with { type: 'json' }
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { fetchNotifyAlerts } from '../metro-trips-notify.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI(response) {
  let stubAPI = new StubAPI()
  stubAPI.setResponses(response || [ notifyAlerts ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

describe('The MetroNotify tracker', () => {
  it('Should insert new alerts into the database', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let metroNotify = await database.createCollection('metro notify')
    let api = createAPI()

    expect(await metroNotify.countDocuments({})).to.equal(0)
    await fetchNotifyAlerts(api, database)
    expect(await metroNotify.countDocuments({})).to.equal(1)
    let alert = await metroNotify.findDocument({})

    expect(alert.alertID).to.not.equal('647069')
    expect(alert.rawAlertID).to.equal('647069')
    expect(alert.routeName).to.have.members(['Mernda'])
    expect(alert.fromDate).to.equal(1749596940)
    expect(alert.toDate).to.equal(1749598800)
    expect(alert.type).to.equal('service')
    expect(alert.text).to.equal('<p>The 8:46am Flinders Street to Epping service is currently running up to 10 minutes late.</p>')
    expect(alert.runID).to.equal('1653')
    expect(alert.active).to.be.true
  })

  it('Should mark old alerts as inactive', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let metroNotify = await database.createCollection('metro notify')

    let normalResponse = clone(notifyAlerts)
    normalResponse[87].alerts = ''

    let api = createAPI([ notifyAlerts, normalResponse ])

    expect(await metroNotify.countDocuments({})).to.equal(0)
    await fetchNotifyAlerts(api, database)
    expect(await metroNotify.countDocuments({})).to.equal(1)
    let alert = await metroNotify.findDocument({})

    expect(alert.rawAlertID).to.equal('647069')
    expect(alert.active).to.be.true

    await fetchNotifyAlerts(api, database)
    expect(await metroNotify.countDocuments({})).to.equal(1)
    alert = await metroNotify.findDocument({})

    expect(alert.rawAlertID).to.equal('647069')
    expect(alert.active).to.be.false
  })

  it('Should create a new alert if the text is updated', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let metroNotify = await database.createCollection('metro notify')

    let secondResponse = clone(notifyAlerts)
    secondResponse[87].alerts[0].alert_text = secondResponse[87].alerts[0].alert_text.replace('10', '20')

    let api = createAPI([ notifyAlerts, secondResponse ])

    expect(await metroNotify.countDocuments({})).to.equal(0)
    await fetchNotifyAlerts(api, database)
    expect(await metroNotify.countDocuments({})).to.equal(1)
    let alert = await metroNotify.findDocument({ active: true })

    expect(alert.rawAlertID).to.equal('647069')
    expect(alert.active).to.be.true

    await fetchNotifyAlerts(api, database)
    expect(await metroNotify.countDocuments({})).to.equal(2)
    let oldAlert = await metroNotify.findDocument({ active: false })
    let newAlert = await metroNotify.findDocument({ active: true })
    expect(oldAlert).to.equal(alert)
    expect(oldAlert.text).to.equal('<p>The 8:46am Flinders Street to Epping service is currently running up to 10 minutes late.</p>')

    expect(newAlert.rawAlertID).to.equal('647069')
    expect(newAlert.alertID).to.not.equal(oldAlert.alertID)
    expect(newAlert.active).to.be.true
    expect(newAlert.text).to.equal('<p>The 8:46am Flinders Street to Epping service is currently running up to 20 minutes late.</p>')
  })
})