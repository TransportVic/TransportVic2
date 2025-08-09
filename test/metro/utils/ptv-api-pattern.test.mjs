import { expect } from 'chai'
import ptvAPIC406 from '../tracker/sample-data/ptv-api-C406.json' with { type: 'json' }
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import getTripUpdateData from '../../../modules/metro-trains/get-stopping-pattern.js'
import tdn3000 from './sample-data/tdn-3000-fss-arrival.json' with { type: 'json' }
import tdn0806 from './sample-data/parliament-only.json' with { type: 'json' }

let clone = o => JSON.parse(JSON.stringify(o))

describe('The getTripUpdateData function', () => {
  it('Should return stopping pattern data in the format used by the trip updater', async () => {
    let stubAPI = new StubAPI()
    stubAPI.setResponses([ ptvAPIC406 ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData('C406', ptvAPI)

    expect(tripData.operationDays).to.equal('20250609')
    expect(tripData.runID).to.equal('C406')
    expect(tripData.routeGTFSID).to.equal('2-CBE')
    expect(tripData.cancelled).to.be.false

    expect(tripData.formedBy).to.be.undefined
    expect(tripData.forming).to.equal('C407')

    expect(tripData.stops[0]).to.deep.equal({
      stopName: 'Cranbourne Railway Station',
      platform: '2',
      scheduledDepartureTime: new Date('2025-06-09T07:09:00.000+10:00'),
      estimatedDepartureTime: new Date('2025-06-09T07:09:40.000+10:00'),
      cancelled: false
    })

    expect(tripData.stops[1]).to.deep.equal({
      stopName: 'Merinda Park Railway Station',
      platform: '1',
      scheduledDepartureTime: new Date('2025-06-09T07:12:00.000+10:00'),
      estimatedDepartureTime: new Date('2025-06-09T07:13:00.000+10:00'),
      cancelled: false
    })

    expect(tripData.stops[tripData.stops.length - 2]).to.deep.equal({
      stopName: 'Richmond Railway Station',
      platform: '5',
      scheduledDepartureTime: new Date('2025-06-09T08:02:00.000+10:00'),
      estimatedDepartureTime: new Date('2025-06-09T08:03:00.000+10:00'),
      cancelled: false
    })

    expect(tripData.stops[tripData.stops.length - 1]).to.deep.equal({
      stopName: 'Flinders Street Railway Station',
      platform: '6',
      scheduledDepartureTime: new Date('2025-06-08T22:15:00.000Z'),
      cancelled: false
    })

    expect(tripData.consist).to.deep.equal([['9024', '9124', '9224', '9324', '9724', '9824', '9924']])
  })

  it('Should mark additional trips as such', async () => {
    let stubAPI = new StubAPI()
    let response = clone(ptvAPIC406)
    response.runs[response.departures[0].run_ref].status = 'added'
    stubAPI.setResponses([ response ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData('C406', ptvAPI)

    expect(tripData.operationDays).to.equal('20250609')
    expect(tripData.runID).to.equal('C406')
    expect(tripData.routeGTFSID).to.equal('2-CBE')
    expect(tripData.cancelled).to.be.false
    expect(tripData.additional).to.be.true
  })

  it('Should discard the FSS "departure" time if it is from the next trip', async () => {
    let stubAPI = new StubAPI()
    let response = clone(tdn3000)
    stubAPI.setResponses([ response ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData('3000', ptvAPI)
    let fss = tripData.stops[tripData.stops.length - 1]
    expect(fss.stopName).to.equal('Flinders Street Railway Station')
    expect(fss.estimatedDepartureTime).to.not.exist
  })

  it('Should replace the FSS arrival time with something sensible if it is taking too long', async () => {
    let stubAPI = new StubAPI()
    stubAPI.setResponses([ clone(tdn0806) ])
    let ptvAPI = new PTVAPI(stubAPI)

    let tripData = await getTripUpdateData('0806', ptvAPI)
    let fss = tripData.stops[tripData.stops.length - 1]
    expect(fss.stopName).to.equal('Flinders Street Railway Station')
    expect(fss.scheduledDepartureTime.toISOString()).to.not.equal('2025-07-17T01:19:00Z')
    expect(+fss.scheduledDepartureTime).to.be.lessThan(+new Date('2025-07-17T01:19:00Z'))
  })
})