import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import utils from '../../utils.js'
import { LokiDatabaseConnection } from '@transportme/database'
import Tracker from '../../application/model/tracker/Tracker.mjs'
import busTrips from './sample-data/bus-trips.mjs'
use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

class BusTracker extends Tracker {
  static getTrackerCollection(db) { return db.getCollection('bus trips') }
}

describe('The Tracker class', () => {
  it('Searches by consist number', async () => {
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.getByFleet('BS05JA', { date: '20251128' })
    expect(trips[0].runID).to.equal('49-601--MF-1591010')
    expect(trips[1].runID).to.equal('49-601--MF-1591110')
  })

  it('Searches by route number', async () => {
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.getByRoute('601', { date: '20251128' })
    expect(trips[0].runID).to.equal('49-601--MF-1602110')
    expect(trips[1].runID).to.equal('49-601--MF-1591010')
  })
})