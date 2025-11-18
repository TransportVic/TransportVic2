import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import alerts from './sample-data/alerts.mjs'
import stations from './sample-data/stations.mjs'
import { getStationAlerts, simplifySummary } from '../../../modules/metro-trains/metro-notify.mjs'
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

  it('Removes default plan your journey text from works alerts', async () => {
    const db = new LokiDatabaseConnection()
    const stops = await db.createCollection('stops')
    const dbRoutes = await db.createCollection('routes')
    const metroNotify = await db.createCollection('metro notify')

    await metroNotify.createDocuments(clone(alerts))
    await stops.createDocuments(clone(stations))
    await dbRoutes.createDocuments(clone(routes))

    const { general } = await getStationAlerts(await stops.findDocument({ stopName: 'Sandown Park Railway Station' }), db)
    expect(general.length).to.equal(1)
    expect(general[0].rawAlertID).to.equal('702508')
    expect(general[0].text).to.equal('<p>Buses replace trains between Caulfield and Dandenong from 8:30pm to last train tonight, while maintenance and renewal works take place.</p>') 
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
    expect(suspended['Stony Point']).to.exist
    expect(suspended['Stony Point'].rawAlertID).to.equal('703017')
    expect(suspended['Stony Point'].summary).to.equal('Buses replace trains between Frankston and Stony Point due to an equipment fault.')
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
    expect(individual[0].summary).to.equal('This service will run direct from Flinders Street to Richmond, not via the City Loop.')
  })

  it('Simplifies the alert text', () => {
    expect(
      simplifySummary('The 8:06am Flinders Street to Belgrave service is running 20 minutes late from Blackburn due to an Ill passenger needing assistance.')
    ).to.equal('This service is running 20 minutes late from Blackburn due to an Ill passenger needing assistance.')

    expect(
      simplifySummary('The 5:18pm Upfield to Flinders Street service will originate from Batman at 5:27pm due to an earlier ill passenger incident.')
    ).to.equal('This service will originate from Batman at 5:27pm due to an earlier ill passenger incident.')

    expect(
      simplifySummary('The 5:16pm Sunbury to Flinders Street service has been altered and will originate from Watergardens at 5:27pm and not cancelled as earlier advised.')
    ).to.equal('This service will originate from Watergardens at 5:27pm and not cancelled as earlier advised.')

    expect(
      simplifySummary('The 4:50pm Flinders Street to Glen Waverley will run direct from Flinders Street to Richmond, not via the City Loop.')
    ).to.equal('This service will run direct from Flinders Street to Richmond, not via the City Loop.')

    expect(
      simplifySummary('The 4:30pm Flinders Street to Sandringham has been terminated at Hampton due to vandalism.')
    ).to.equal('This service has been terminated at Hampton due to vandalism.')
  })
})
