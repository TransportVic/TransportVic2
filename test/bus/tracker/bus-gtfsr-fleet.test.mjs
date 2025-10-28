import { LokiDatabaseConnection } from '@transportme/database'
import { expect } from 'chai'
import { getFleetData } from '../../../modules/new-tracker/bus/bus-gtfsr-fleet.mjs'
import gtfsr733Positions from './sample-data/gtfsr-733-positions.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The bus fleet tracker', () => {
  it('Creates trip updates from the GTFSR data', async () => {
    let database = new LokiDatabaseConnection()
    const trips = Object.values(await getFleetData(database, () => gtfsr733Positions))
    expect(trips[0].operationDays).to.equal('20251025')
    expect(trips[0].runID).to.equal('20-733--1-Sat2-31')
    expect(trips[0].routeGTFSID).to.equal('4-733')
    expect(trips[0].consist[0]).to.equal('BS12YD')
  })

  it('Handles vehicle rego overrides', async () => {
    let database = new LokiDatabaseConnection()
    const busRegos = database.getCollection('bus regos')
    busRegos.createDocument({
      fleetNumber: "V1678",
      operator: "V",
      rego: "TEST",
      trackedRego: "BS12YD"
    })

    const trips = Object.values(await getFleetData(database, () => gtfsr733Positions))
    expect(trips[0].operationDays).to.equal('20251025')
    expect(trips[0].runID).to.equal('20-733--1-Sat2-31')
    expect(trips[0].routeGTFSID).to.equal('4-733')
    expect(trips[0].consist[0]).to.equal('TEST')
  })
})