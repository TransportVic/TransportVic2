import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import almTrips from '../departures/sample-data/sample-live-trips.json' with { type: 'json' }
import mtpThroughRunning from '../departures/sample-data/mtp-through-running.json' with { type: 'json' }
import alm from '../departures/sample-data/alamein.json' with { type: 'json' }
import { getPIDDepartures } from '../../modules/pid/pid.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import crossCityThroughRunning from '../departures/sample-data/cross-city-through-running.json' with { type: 'json' }
import fknStops from './sample-data/fkn-stops.mjs'
import pkmStops from '../metro/tracker/sample-data/pkm-stops-db.json' with { type: 'json' }

use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

const almDepartureTime = { departureTime: new Date('2025-03-28T20:48:00.000Z') }
const almDB = new LokiDatabaseConnection()
await (await almDB.getCollection('live timetables')).createDocuments(clone(almTrips).map((trip, i) => {
  if (i === 1) return {
    ...trip,
    stopTimings: [ trip.stopTimings[0], trip.stopTimings[trip.stopTimings.length - 1] ]
  }

  if (i === 2) return {
    ...trip,
    stopTimings: [ trip.stopTimings[0], trip.stopTimings[3], trip.stopTimings[trip.stopTimings.length - 1] ]
  }

  return trip
}))
await (await almDB.getCollection('stops')).createDocument(clone(alm))

const crossCityDepartureTime_SYR = { departureTime: new Date('2025-06-11T07:30:00.000Z') }
const crossCityDB = new LokiDatabaseConnection()
await (await crossCityDB.getCollection('live timetables')).createDocuments(clone(crossCityThroughRunning))
await (await crossCityDB.getCollection('stops')).createDocuments(clone(fknStops))
await (await crossCityDB.getCollection('stops')).createDocuments(clone(pkmStops))

const crossCityNoFormingDB = new LokiDatabaseConnection()
await (await crossCityNoFormingDB.getCollection('live timetables')).createDocuments(clone(crossCityThroughRunning).map(trip => {
  return {
    ...trip,
    forming: null,
    formedBy: null
  }
}))
await (await crossCityNoFormingDB.getCollection('stops')).createDocuments(clone(fknStops))
await (await crossCityNoFormingDB.getCollection('stops')).createDocuments(clone(pkmStops))

const cfdDepartureTime = { departureTime: new Date('2025-06-06T20:04:00.000Z') }
const cfdDB = new LokiDatabaseConnection()
await (await cfdDB.getCollection('live timetables')).createDocuments(clone(mtpThroughRunning).map((trip, i) => {
  if (i === 1) return {
    ...trip,
    stopTimings: trip.stopTimings.slice(0, 3).concat(trip.stopTimings.slice(5))
  }
  return trip
}))
await (await cfdDB.getCollection('stops')).createDocuments(clone(fknStops))

describe('The PID getPIDDepartures function', () => {
  it('Returns a list of departures', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    expect(departures).to.exist
    expect(departures.length).to.be.greaterThan(0)
  })

  it('Fails gracefully with non-existent stations', async () => {
    const departures = await getPIDDepartures('Lol', almDB, almDepartureTime)
    expect(departures).to.exist
    expect(departures.length).to.be.equal(0)
  })

  it('Provides basic departure data', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.false
    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Camberwell')
    expect(departures[0].direction).to.equal('Up')
  })

  it('Returns a list of stops to display on the screen', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    const stops = departures[0].stops
    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ name: 'Alamein', stops: true })
    expect(stops[1]).to.deep.equal({ name: 'Ashburton', stops: true })
    expect(stops[6]).to.deep.equal({ name: 'Camberwell', stops: true })
  })

  it('Returns express stops on the list of stops', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    const stops = departures[1].stops
    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ name: 'Alamein', stops: true })
    expect(stops[1]).to.deep.equal({ name: 'Ashburton', stops: false })
    expect(stops[2]).to.deep.equal({ name: 'Burwood', stops: false })
    expect(stops[6]).to.deep.equal({ name: 'Camberwell', stops: true })
  })

  it('Removes city loop stops if not needed', async () => {
    const departures = await getPIDDepartures('South Yarra', crossCityNoFormingDB, crossCityDepartureTime_SYR)
    const stops = departures[0].stops

    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ name: 'South Yarra', stops: true })
    expect(stops[1]).to.deep.equal({ name: 'Richmond', stops: true })
    expect(stops[2]).to.deep.equal({ name: 'Flinders Street', stops: true })
  })

  it('Appends stops from the next trip onto the PID', async () => {
    const departures = await getPIDDepartures('South Yarra', crossCityDB, crossCityDepartureTime_SYR)
    const stops = departures[0].stops

    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ name: 'South Yarra', stops: true })
    expect(stops[1]).to.deep.equal({ name: 'Richmond', stops: true })
    expect(stops[2]).to.deep.equal({ name: 'Flinders Street', stops: true })
    expect(stops[3]).to.deep.equal({ name: 'Southern Cross', stops: true })
    expect(stops[4]).to.deep.equal({ name: 'North Melbourne', stops: false })
  })

  it('Checks express running on the forming trip', async () => {
    const departures = await getPIDDepartures('Caulfield', cfdDB, cfdDepartureTime)
    const stops = departures[0].stops

    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ name: 'Caulfield', stops: true })
    expect(stops[1]).to.deep.equal({ name: 'Malvern', stops: false })
    expect(stops[5]).to.deep.equal({ name: 'Anzac', stops: true })
    expect(stops[6]).to.deep.equal({ name: 'Town Hall', stops: true })
    expect(stops[7]).to.deep.equal({ name: 'State Library', stops: true })
    expect(stops[10]).to.deep.equal({ name: 'Footscray', stops: false })
    expect(stops[12]).to.deep.equal({ name: 'West Footscray', stops: true })
  })

  it('Contains a stopping pattern and types on an SAS train', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    expect(departures[0].stoppingPattern).to.equal('Stops All Stations')
    expect(departures[0].stoppingType).to.equal('Stops All')
    expect(departures[0].extendedStoppingType).to.equal('Stopping All Stations')
  })

  it('Contains a stopping pattern and types on a cross city train', async () => {
    const departures = await getPIDDepartures('South Yarra', crossCityDB, { departureTime: new Date('2025-06-11T06:49:00.000Z') })
    expect(departures[0].stoppingPattern).to.equal('Stops All Stations to Southern Cross, then Runs Express to Williamstown')
    expect(departures[0].stoppingType).to.equal('Express')
    expect(departures[0].extendedStoppingType).to.equal('Express Southern Cross -- Williamstown')
  })
})