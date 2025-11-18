import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import alerts from './sample-data/alerts.mjs'
import stations from './sample-data/stations.mjs'
import { getStationAlerts } from '../../../modules/metro-trains/metro-notify.mjs'
import routes from './sample-data/routes.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The metro notify module', () => { 
  it('Returns station-level alerts', async () => {
    const db = new LokiDatabaseConnection()
    const stops = await db.createCollection('stops')
    const dbRoutes = await db.createCollection('routes')
    const metroNotify = await db.createCollection('metro notify')

    await metroNotify.createDocuments(clone(alerts))
    await stops.createDocuments(clone(stations))
    await dbRoutes.createDocuments(clone(routes))

    const { general } = await getStationAlerts(await stops.findDocument({ stopName: 'Baxter Railway Station' }), db)
    expect(general.length).to.equal(1)
    expect(general[0].rawAlertID).to.equal('703017')
    expect(general[0].type).to.equal('suspended') 
  })

  it('Returns a list of suspended lines', async () => {
    const db = new LokiDatabaseConnection()
    const stops = await db.createCollection('stops')
    const dbRoutes = await db.createCollection('routes')
    const metroNotify = await db.createCollection('metro notify')

    await metroNotify.createDocuments(clone(alerts))
    await stops.createDocuments(clone(stations))
    await dbRoutes.createDocuments(clone(routes))

    const { suspended } = await getStationAlerts(await stops.findDocument({ stopName: 'Frankston Railway Station' }), db)
    expect(suspended).to.deep.equal(['Stony Point'])
  })

  it('Returns a individual train alerts', async () => {
    const db = new LokiDatabaseConnection()
    const stops = await db.createCollection('stops')
    const dbRoutes = await db.createCollection('routes')
    const metroNotify = await db.createCollection('metro notify')
    
    await metroNotify.createDocuments(clone(alerts))
    await stops.createDocuments(clone(stations))
    await dbRoutes.createDocuments(clone(routes))

    const { individual } = await getStationAlerts(await stops.findDocument({ stopName: 'Darling Railway Station' }), db)
    expect(individual.length).to.equal(1)
    expect(individual[0].runID).to.equal('2637')
  })
})
