import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import almTrips from '../departures/sample-data/sample-live-trips.json' with { type: 'json' }
import alm from '../departures/sample-data/alamein.json' with { type: 'json' }
import { getPIDDepartures, getScreenStopsAndExpress, getStoppingText } from '../../modules/pid/pid.mjs'
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

  if (i === 2) return {
    ...trip,
    stopTimings: [ trip.stopTimings[0], trip.stopTimings[3], trip.stopTimings[trip.stopTimings.length - 1] ]
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

describe('The getScreenStopsAndExpress function', () => {
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
    const { stops } = getScreenStopsAndExpress(futureStops, clone(almTrips[0]))

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
    const { stops } = getScreenStopsAndExpress([
      'Alamein',
      'Camberwell'
    ], clone(almTrips[0]))
    expect(stops.length).to.equal(futureStops.length)
    for (let i = 0; i < stops.length; i++) expect(stops[i].stopName).to.equal(futureStops[i])
    for (let i = 1; i < stops.length - 1; i++) expect(stops[i].express).to.be.true
  })

  it('Returns a list of express sections when there is a single section', () => {
    const { expressSections } = getScreenStopsAndExpress([
      'Alamein',
      'Camberwell'
    ], clone(almTrips[0]))

    expect(expressSections).to.deep.equal([ [
      'Ashburton',
      'Burwood',
      'Hartwell',
      'Willison',
      'Riversdale',
    ] ])
  })

  it('Returns a list of express sections are multiple sections', () => {
    const { expressSections } = getScreenStopsAndExpress([
      'Alamein',
      'Hartwell',
      'Camberwell'
    ], clone(almTrips[0]))

    expect(expressSections).to.deep.equal([ [
      'Ashburton',
      'Burwood'
    ], [
      'Willison',
      'Riversdale'
    ] ])
  })

  it('Returns the second last stop as its own express section', () => {
    const { expressSections } = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      'Hartwell',
      'Willison',
      'Camberwell'
    ], clone(almTrips[0]))

    expect(expressSections).to.deep.equal([ [
      'Riversdale'
    ] ])
  })
})

/**
 * {
  stopsAll: 'Stops All Stations',
  allExcept: 'All Except {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  thenRunsExpressTo: 'then Runs Express to {0}',
  thenRunsExpressAtoB: 'then Runs Express from {0} to {1}',
  sasTo: 'Stops All Stations to {0}',
  stopsAt: 'Stops At {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}
 */
describe('The getStoppingText function', () => {
  it('Stops all stations', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      'Hartwell',
      'Willison',
      'Riversdale',
      'Camberwell'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations')
  })

  it('Skips a single station', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      'Willison',
      'Riversdale',
      'Camberwell',
      'Auburn',
      'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('All Except Hartwell')
  })

  it('Skips two stations in a row', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      // 'Willison',
      'Riversdale',
      'Camberwell',
      'Auburn',
      'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations to Burwood, Runs Express from Burwood to Riversdale, then Stops All Stations to Hawthorn')
  })

  it('Two express blocks with a single stop in between', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      'Willison',
      // 'Riversdale',
      'Camberwell',
      'Auburn',
      'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations to Burwood, Runs Express from Burwood to Willison, Willison to Camberwell, then Stops All Stations to Hawthorn')
  })

  it('Two express blocks with two stops in between', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      'Willison',
      'Riversdale',
      // 'Camberwell',
      'Auburn', // Just to add the extra stop so its not express to the last stop
      'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations to Burwood, Runs Express from Burwood to Willison, Runs Express from Riversdale to Auburn, then Stops All Stations to Hawthorn')
  })

  it('Two express blocks with more than two stops in between', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      'Willison',
      'Riversdale',
      'Camberwell',
      // 'Auburn',
      'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations to Burwood, Runs Express from Burwood to Willison, Stops All Stations from Willison to Camberwell, Runs Express from Camberwell to Glenferrie, then Stops All Stations to Hawthorn')
  })

  it('Single stop before running express', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      // 'Burwood',
      // 'Hartwell',
      // 'Willison',
      'Riversdale',
      'Camberwell',
      'Auburn',
      'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops At Ashburton, Runs Express from Ashburton to Riversdale, then Stops All Stations to Hawthorn')
  })

  it('Stops along the way, then express to the last stop', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      // 'Willison',
      // 'Riversdale',
      // 'Camberwell',
      // 'Auburn',
      // 'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations to Burwood, then Runs Express to Hawthorn')
  })

  it('Express all the way', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      // 'Ashburton',
      // 'Burwood',
      // 'Hartwell',
      // 'Willison',
      // 'Riversdale',
      // 'Camberwell',
      // 'Auburn',
      // 'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Runs Express to Hawthorn')
  })
})