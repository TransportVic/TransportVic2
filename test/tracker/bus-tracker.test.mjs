import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import utils from '../../utils.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import busTrips from './sample-data/bus-trips.mjs'
import BusTracker from '../../application/model/tracker/BusTracker.mjs'
import busRegos from './sample-data/bus-regos.mjs'
use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

describe('The BusTracker class', () => {
  it('Searches by fleet number', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    const regosColl = db.getCollection('bus regos')
    await tripsColl.createDocuments(clone(busTrips))
    await regosColl.createDocuments(clone(busRegos))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByFleet('CO171', { date: '20251128' })
    expect(trips[0].runID).to.equal('49-601--MF-1591010')
    expect(trips[1].runID).to.equal('49-601--MF-1591110')
  })

  it('Searches by rego', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    const regosColl = db.getCollection('bus regos')
    await tripsColl.createDocuments(clone(busTrips))
    await regosColl.createDocuments(clone(busRegos))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByFleet('1013AO', { date: '20251128' })
    expect(trips[0].runID).to.equal('49-601--MF-1602110')
    expect(trips[1].runID).to.equal('49-601--MF-1602210')
  })

  it('Adds fleet data when searching by route number', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    const regosColl = db.getCollection('bus regos')
    await tripsColl.createDocuments(clone(busTrips))
    await regosColl.createDocuments(clone(busRegos))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByRoute('601', { date: '20251128' })
    const trip1 = trips.find(t => t.runID === '49-601--MF-1602110')
    expect(trip1.displayConsist).to.equal('#CO13')

    const trip2 = trips.find(t => t.runID === '49-601--MF-1591010')
    expect(trip2.displayConsist).to.equal('#CO171')
  })

  it('Retains the rego when the fleet number cannot be determined', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    const regosColl = db.getCollection('bus regos')
    await tripsColl.createDocuments(clone(busTrips))
    await regosColl.createDocuments(clone(busRegos))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByRoute('601', { date: '20251127' })
    const trip1 = trips.find(t => t.runID === '49-601--MF-1602110')
    expect(trip1.displayConsist).to.equal('7509AO')
  })

  it('Sets origin and destination overrides', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    await tripsColl.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByRoute('384', { date: '20251127' })
    expect(trips[0].origin).to.equal('Kinglake')
    expect(trips[0].destination).to.equal('Whittlesea')
  })

  it('Shortens Railway Station and Shopping Centre', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    await tripsColl.createDocuments(clone(busTrips))

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByRoute('601', { date: '20251127' })
    expect(trips[0].origin).to.equal('Huntingdale Station')
  })

  it('Removes secondary stop names on origin and destinations', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    await tripsColl.createDocument({
      ...clone(busTrips.find(trip => trip.routeNumber === '630')),
      routeNumber: '999'
    })

    const tracker = new BusTracker(db)
    const trips = await tracker.getTripsByRoute('999', { date: '20251128' })
    expect(trips[0].origin).to.equal('St. Kilda Street')
    expect(trips[0].destination).to.equal('Monash Uni Clayton')
  })

  it('Sets rego data on the history where possible', async () => {
    const db = new LokiDatabaseConnection()
    const tripsColl = db.getCollection('bus trips')
    const regosColl = db.getCollection('bus regos')
    await tripsColl.createDocuments(clone(busTrips))
    await regosColl.createDocuments(clone(busRegos))

    const tracker = new BusTracker(db)
    const history = await tracker.setRegosOnHistory(await tracker.getHistory({ routeNumber: '601' }, 'consist'))
    expect(history).to.deep.equal([{
      date: '20251128',
      humanDate: '28/11/2025',
      data: [ 'CO13', 'CO171' ]
    },
    {
      date: '20251127',
      humanDate: '27/11/2025',
      data: [ '7509AO', 'CO171' ]
    }])
  })
})