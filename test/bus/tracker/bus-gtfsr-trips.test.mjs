import { expect } from 'chai'
import gtfsr273TripUpdate from './sample-data/gtfsr-273-trip-update.mjs'
import { getUpcomingTrips } from '../../../modules/new-tracker/bus/bus-gtfsr-trips.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The GTFSR bus trips updater', () => {
  it('Returns trip update data', async () => {
    const trips = Object.values(await getUpcomingTrips(() => gtfsr273TripUpdate))
    expect(trips[0].operationDays).to.equal('20251231')
    expect(trips[0].runID).to.equal('14-273--MF-273031')
    expect(trips[0].routeGTFSID).to.equal('4-273')
    expect(trips[0].stops[0]).to.deep.equal({
      stopGTFSID: '4105',
      "estimatedArrivalTime": new Date('2025-12-31T01:47:12.000Z'),
      "estimatedDepartureTime": new Date('2025-12-31T01:47:12.000Z'),
      cancelled: false,
      stopSequence: 4
    })
  })
})