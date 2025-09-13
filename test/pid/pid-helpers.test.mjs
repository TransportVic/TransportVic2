import { expect, use } from 'chai'
import chaiExclude from 'chai-exclude'
import almTrips from '../departures/sample-data/sample-live-trips.json' with { type: 'json' }
import { getScreenStopsAndExpress, getStoppingText } from '../../modules/pid/pid.mjs'
use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

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

  it('Last express block is straight to the last stop', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      // 'Ashburton',
      // 'Burwood',
      // 'Hartwell',
      'Willison',
      // 'Riversdale',
      // 'Camberwell',
      // 'Auburn',
      // 'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Runs Express to Willison, then Runs Express from Willison to Hawthorn')
  })

  it('Stops some stops first, express, then last express block is straight to the last stop', () => {
    const expressData = getScreenStopsAndExpress([
      'Alamein',
      'Ashburton',
      'Burwood',
      // 'Hartwell',
      // 'Willison',
      'Riversdale',
      // 'Camberwell',
      // 'Auburn',
      // 'Glenferrie',
      'Hawthorn'
    ], clone(almTrips[0]))

    const stoppingText = getStoppingText(expressData)
    expect(stoppingText).to.equal('Stops All Stations to Burwood, Runs Express from Burwood to Riversdale, then Runs Express from Riversdale to Hawthorn')
  })
})