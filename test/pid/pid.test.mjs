import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import almTrips from '../departures/sample-data/sample-live-trips.json' with { type: 'json' }
import alm from '../departures/sample-data/alamein.json' with { type: 'json' }
import { getPIDDepartures } from '../../modules/pid/pid.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import fknWerWillSASThroughRunning from './sample-data/fkn-wer-will-sas-through-running.mjs'
import fknStops from './sample-data/fkn-stops.mjs'
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

const fknDepartureTime = { departureTime: new Date('2025-09-13T07:56:00.000Z') }
const fknDB = new LokiDatabaseConnection()
await (await fknDB.getCollection('live timetables')).createDocuments(clone(fknWerWillSASThroughRunning))
await (await fknDB.getCollection('stops')).createDocuments(clone(fknStops))

const fknNoFormingDB = new LokiDatabaseConnection()
await (await fknNoFormingDB.getCollection('live timetables')).createDocuments(clone(fknWerWillSASThroughRunning).map(trip => {
  return {
    ...trip,
    forming: null,
    formedBy: null
  }
}))
await (await fknNoFormingDB.getCollection('stops')).createDocuments(clone(fknStops))

describe('The PID getPIDDepartures function', () => {
  it('Returns a list of departures', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    expect(departures).to.exist
    expect(departures.length).to.be.greaterThan(0)
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
    expect(stops[0]).to.deep.equal({ stopName: 'Alamein', express: false })
    expect(stops[1]).to.deep.equal({ stopName: 'Ashburton', express: false })
    expect(stops[6]).to.deep.equal({ stopName: 'Camberwell', express: false })
  })

  it('Returns express stops on the list of stops', async () => {
    const departures = await getPIDDepartures('Alamein', almDB, almDepartureTime)
    const stops = departures[1].stops
    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ stopName: 'Alamein', express: false })
    expect(stops[1]).to.deep.equal({ stopName: 'Ashburton', express: true })
    expect(stops[2]).to.deep.equal({ stopName: 'Burwood', express: true })
    expect(stops[6]).to.deep.equal({ stopName: 'Camberwell', express: false })
  })

  it('Removes city loop stops if not needed', async () => {
    const departures = await getPIDDepartures('Caulfield', fknNoFormingDB, fknDepartureTime)
    const stops = departures[0].stops

    expect(stops).to.exist
    expect(stops[0]).to.deep.equal({ stopName: 'Caulfield', express: false })
    expect(stops[1]).to.deep.equal({ stopName: 'Malvern', express: false })
    expect(stops[6]).to.deep.equal({ stopName: 'Richmond', express: false })
    expect(stops[7]).to.deep.equal({ stopName: 'Flinders Street', express: false })
  })
})