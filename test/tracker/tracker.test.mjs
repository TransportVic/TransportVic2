import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import utils from '../../utils.mjs'
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
  const originalNow = utils.now

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

  it('Marks trips as inactive if they are completed and on the current day', async () => {
    utils.now = () => utils.parseTime('2025-11-28T00:30:00.000Z') // 11.30am
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.searchWithDate({ routeNumber: '601' }, '20251128')
    // Ends 11.23am
    expect(trips.find(trip => trip.runID === '49-601--MF-1602310').active).to.be.false

    // Ends 11.47am
    expect(trips.find(trip => trip.runID === '49-601--MF-1591610').active).to.be.true
  })

  it('Does not mark trips as inactive if they are on a different day', async () => {
    utils.now = () => utils.parseTime('2025-11-28T00:30:00.000Z') //20251128
    const db = new LokiDatabaseConnection()
    const coll = db.getCollection('bus trips')
    await coll.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.searchWithDate({ routeNumber: '601' }, '20251127')
    expect(trips.find(trip => !trip.active)).to.not.exist
  })

  afterEach(() => utils.now = originalNow)
})