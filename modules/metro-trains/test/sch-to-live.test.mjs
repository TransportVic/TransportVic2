import { expect } from 'chai'
import regSchTrip from './sample-data/sch-trip-reg.json' with { type: 'json' }
import { convertToLive } from '../sch-to-live.js'

describe('The convertToLive function', () => {
  it('Should convert the operationDays to a single day', async () => {
    let trip = convertToLive(regSchTrip, new Date('2025-03-28T21:00:00.000Z'))
    expect(trip.operationDays).to.equal('20250329')
  })

  it('Should add a scheduledDepartureTime field to the stop timings', async () => {
    let trip = convertToLive(regSchTrip, new Date('2025-03-28T21:00:00.000Z'))
    expect(trip.stopTimings[0].stopName).to.equal('Alamein Railway Station')
    expect(trip.stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T22:08:00.000Z')
  })
})