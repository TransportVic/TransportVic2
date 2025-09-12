import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import almTrips from '../departures/sample-data/sample-live-trips.json' with { type: 'json' }
import alm from '../departures/sample-data/alamein.json' with { type: 'json' }
import { getPIDDepartures, getScreenStops } from '../../modules/pid/pid.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

const almDepartureTime = { departureTime: new Date('2025-03-28T20:48:00.000Z') }
const almDB = new LokiDatabaseConnection()
await (await almDB.getCollection('live timetables')).createDocuments(clone(almTrips).map((trip, i) => {
  if (i === 1) return {
    ...trip,
    stopTimings: [ trip.stopTimings[0], trip.stopTimings[trip.stopTimings.length - 1] ]
  }

  return trip
}))
await (await almDB.getCollection('stops')).createDocument(clone(alm))

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
})

describe('The getScreenStops function', () => {
  it('Returns a list of all stops passed by that departure', async () => {
    const futureStops = [
      'Alamein',
      'Ashburton',
      'Burwood',
      'Hartwell',
      'Willison',
      'Riversdale',
      'Camberwell'
    ]
    const stops = getScreenStops(futureStops, {
      routeName: 'Alamein',
      direction: 'Up',
      trip: clone(almTrips[0])
    })

    expect(stops.length).to.equal(futureStops.length)
    for (let i = 0; i < stops.length; i++) {
      expect(stops[i].stopName).to.equal(futureStops[i])
      expect(stops[i].express).to.be.false
    }
  })

  it('Includes a single expess block', async () => {
    const futureStops = [
      'Alamein',
      'Ashburton',
      'Burwood',
      'Hartwell',
      'Willison',
      'Riversdale',
      'Camberwell'
    ]
    const stops = getScreenStops([
      'Alamein',
      'Camberwell'
    ], {
      routeName: 'Alamein',
      direction: 'Up',
      trip: clone(almTrips[0])
    })

    expect(stops.length).to.equal(futureStops.length)
    for (let i = 0; i < stops.length; i++) expect(stops[i].stopName).to.equal(futureStops[i])
    for (let i = 1; i < stops.length - 1; i++) expect(stops[i].express).to.be.true
  })
})