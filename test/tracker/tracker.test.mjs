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
  static getURLMode() { return 'bus' }
}

describe('The Tracker class', () => {
  it('Searches by consist number', async () => {
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByFleet('BS05JA', { date: '20251128' })
    expect(trips[0].runID).to.equal('49-601--MF-1591010')
    expect(trips[1].runID).to.equal('49-601--MF-1591110')
  })

  it('Searches by route number', async () => {
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByRoute('601', { date: '20251128' })
    expect(trips[0].runID).to.equal('49-601--MF-1602110')
    expect(trips[1].runID).to.equal('49-601--MF-1591010')
  })

  it('Gets the history based on a query', async () => {
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const history = await tracker.getHistory({ routeNumber: '601' }, 'consist')
    expect(history).to.deep.equal([{
      date: '20251128',
      humanDate: '28/11/2025',
      data: ['1013AO', 'BS05JA']
    }, {
      date: '20251127',
      humanDate: '27/11/2025',
      data: ['7509AO', 'BS05JA']
    }])
  })

  it('Sets the trip data', async () => {
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.searchWithDate({ routeNumber: '601' }, '20251128')
    expect(trips[0].runID).to.equal('49-601--MF-1602110')
    expect(trips[0].tripURL).to.equal('/bus/run/huntingdale-railway-station-haughton-road/11:00/monash-university-bus-loop/11:07/20251128')
    expect(trips[0].destinationArrivalMoment.toISOString()).to.equal('2025-11-28T00:07:00.000Z') // 11.07am
  })
})