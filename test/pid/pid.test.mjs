import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import almTrips from '../departures/sample-data/sample-live-trips.json' with { type: 'json' }
import alm from '../departures/sample-data/alamein.json' with { type: 'json' }
import { getPIDDepartures } from '../../modules/pid/pid.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

const almDB = new LokiDatabaseConnection()
await (await almDB.getCollection('live timetables')).createDocuments(clone(almTrips))
await (await almDB.getCollection('stops')).createDocument(clone(alm))

describe('The PID getPIDDepartures function', () => {
  it('Returns a list of departures', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, { departureTime: new Date('2025-03-28T20:48:00.000Z') })
    expect(departures).to.exist
    expect(departures.length).to.be.greaterThan(0)
  })

  it('Provides basic departure data', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, { departureTime: new Date('2025-03-28T20:48:00.000Z') })
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.false
    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Camberwell')
    expect(departures[0].direction).to.equal('Up')
  })
})