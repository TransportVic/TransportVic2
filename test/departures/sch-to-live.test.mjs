import { expect } from 'chai'
import regSchTrip from './sample-data/sch-trip-reg.json' with { type: 'json' }
import schTripRep2am from './sample-data/sch-trip-rep-2am.json' with { type: 'json' }
import convertToLive from '../../modules/departures/sch-to-live.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The convertToLive function', () => {
  it('Should convert the operationDays to a single day', async () => {
    let trip = convertToLive(clone(regSchTrip), new Date('2025-03-28T21:00:00.000Z'))
    expect(trip.operationDays).to.equal('20250329')
  })

  it('Should add a scheduledDepartureTime field to the stop timings', async () => {
    let trip = convertToLive(clone(regSchTrip), new Date('2025-03-28T21:00:00.000Z'))
    expect(trip.stopTimings[0].stopName).to.equal('Alamein Railway Station')
    expect(trip.stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T22:08:00.000Z')
    expect(trip.stopTimings[0].actualDepartureTimeMS).to.equal(+new Date('2025-03-28T22:08:00.000Z'))

    expect(trip.stopTimings[6].stopName).to.equal('Camberwell Railway Station')
    expect(trip.stopTimings[6].scheduledDepartureTime).to.equal('2025-03-28T22:19:00.000Z')
    expect(trip.stopTimings[6].scheduledDepartureTimeMS).to.equal(+new Date('2025-03-28T22:19:00.000Z'))
  })

  it('Should account for a DST repeated 2am and add an extra hour', async () => {
    let trip = convertToLive(clone(regSchTrip), new Date('2025-04-05T21:00:00.000Z'))
    expect(trip.stopTimings[0].stopName).to.equal('Alamein Railway Station')
    expect(trip.stopTimings[0].departureTimeMinutes).to.equal(9 * 60 + 8 + 60) // Extra 60 for the repeated 2am
    expect(trip.stopTimings[0].scheduledDepartureTime).to.equal('2025-04-05T23:08:00.000Z')

    expect(trip.stopTimings[6].stopName).to.equal('Camberwell Railway Station')
    expect(trip.stopTimings[6].scheduledDepartureTime).to.equal('2025-04-05T23:19:00.000Z')
  })

  it('Should account for a DST skipped 2am and remove the missing hour', async () => {
    let trip = convertToLive(clone(regSchTrip), new Date('2024-10-05T21:00:00.000Z'))
    expect(trip.stopTimings[0].stopName).to.equal('Alamein Railway Station')
    expect(trip.stopTimings[0].departureTimeMinutes).to.equal(9 * 60 + 8 - 60) // Extra 60 for the repeated 2am
    expect(trip.stopTimings[0].scheduledDepartureTime).to.equal('2024-10-05T22:08:00.000Z')

    expect(trip.stopTimings[6].stopName).to.equal('Camberwell Railway Station')
    expect(trip.stopTimings[6].scheduledDepartureTime).to.equal('2024-10-05T22:19:00.000Z')
  })

  it('Should update the HH:MM times to reflect the repeated 2am', async () => {
    let trip = convertToLive(clone(schTripRep2am), new Date('2025-04-04T13:00:00.000Z'))
    expect(trip.stopTimings[0].stopName).to.equal('Lilydale Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('02:48')
    expect(trip.stopTimings[0].departureTimeMinutes).to.equal(26 * 60 + 48)

    expect(trip.stopTimings[2].stopName).to.equal('Croydon Railway Station')
    expect(trip.stopTimings[2].departureTime).to.equal('02:57')
    expect(trip.stopTimings[2].departureTimeMinutes).to.equal(26 * 60 + 57)

    expect(trip.stopTimings[3].stopName).to.equal('Ringwood East Railway Station')
    expect(trip.stopTimings[3].departureTime).to.equal('02:01')
    expect(trip.stopTimings[3].departureTimeMinutes).to.equal(27 * 60 + 1)
  })
})