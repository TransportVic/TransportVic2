import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import alerts from './sample-data/alerts.mjs'
import stations from './sample-data/stations.mjs'
import { getDirection, getMaxDelay, getStationAlerts, simplifySummary } from '../../../modules/metro-trains/metro-notify.mjs'
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

  it('Returns individual train alerts', async () => {
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

  it('Returns delay alerts', async () => {
    const db = new LokiDatabaseConnection()
    const stops = await db.createCollection('stops')
    const dbRoutes = await db.createCollection('routes')
    const metroNotify = await db.createCollection('metro notify')
    
    await metroNotify.createDocuments(clone(alerts))
    await stops.createDocuments(clone(stations))
    await dbRoutes.createDocuments(clone(routes))

    const { delays } = await getStationAlerts(await stops.findDocument({ stopName: 'Sandown Park Railway Station' }), db)

    expect(delays['Cranbourne']).to.exist
    expect(delays['Pakenham']).to.exist
    expect(delays['Cranbourne'].maxDelay).to.equal(10)
    expect(delays['Cranbourne'].direction).to.null
  })

  it('Excludes delay alerts tagged on a particular service', async () => {
    const db = new LokiDatabaseConnection()
    const stops = await db.createCollection('stops')
    const dbRoutes = await db.createCollection('routes')
    const metroNotify = await db.createCollection('metro notify')

    await metroNotify.createDocuments(clone(alerts).filter(alert => alert.rawAlertID === '497756'))
    await stops.createDocuments(clone(stations))
    await dbRoutes.createDocuments(clone(routes))

    const { individual, delays } = await getStationAlerts(await stops.findDocument({ stopName: 'Sandown Park Railway Station' }), db)

    expect(delays['Cranbourne']).to.not.exist
    expect(delays['Pakenham']).to.not.exist
    expect(individual.length).to.equal(1)
  })

  it('Extracts the delay time from an alert', () => {
    expect(
      getMaxDelay('<p>Trains are on the move with delays up to 30 minutes now clearing after a police request near Coolaroo.</p>')
    ).to.equal(30)

    expect(
      getMaxDelay('<p>There may be delays of up to 90 minutes after ambulance attend to an ill passenger at Kooyong.</p>')
    ).to.equal(90)

    expect(
      getMaxDelay('<p>Citybound delays 30 minutes and clearing after an earlier operational incident in the Laburnum area.</p>')
    ).to.equal(30)

    expect(
      getMaxDelay('<p>Buses replace trains between Diamond Creek and Hurstbridge due to a track fault near Wattle Glen.</p>')
    ).to.equal(null)
  })

  it('Extracts the direction from an alert', () => {
    expect(
      getDirection('<p>City bound delays up to 20 minutes after a police request in the East Malvern area.</p>')
    ).to.equal('Up')

    expect(
      getDirection('<p>Citybound delays 30 minutes and clearing after an earlier operational incident in the Laburnum area.</p>')
    ).to.equal('Up')

    expect(
      getDirection('<p>Delays of up to 20 minutes for inbound services and clearing after an earlier police request near the Westall area.</p>')
    ).to.equal('Up')

    // Both directions
    expect(
      getDirection('<p>Citybound delays up to 90 minutes and outbound delays up to 45 minutes between Lilydale and Ringwood due to vandalism in the Mooroolbark area.</p>')
    ).to.equal(null)

    expect(
      getDirection('<p>Delays up to 20 minutes for outbound services due to an equipment fault in the Clayton area.</p>')
    ).to.equal('Down')

    expect(
      getDirection('<p>There may be out bound delays of up 25 minutes due to an operational incident at North Melbourne.</p>')
    ).to.equal('Down')
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
