import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleLiveTrips from '../../departures/test/sample-data/sample-live-trips.json' with { type: 'json' }
import sampleSchTrips from '../../departures/test/sample-data/sample-sch-trips.json' with { type: 'json' }
import alamein from '../../departures/test/sample-data/alamein.json' with { type: 'json' }
import getDepartures from '../get-departures.js'
import utils from '../../../utils.js'

let clone = o => JSON.parse(JSON.stringify(o))

const db = new LokiDatabaseConnection()
db.connect()
await (await db.createCollection('gtfs timetables')).createDocuments(clone(sampleSchTrips))
await (await db.createCollection('live timetables')).createDocuments(clone(sampleLiveTrips))

describe('The metro departures class', () => {
  it('Should return key departure data extracted from the trips returned', async () => {
    let departures = await getDepartures(alamein, db, null, null, new Date('2025-03-28T20:40:00.000Z'))
    expect(departures.length).to.equal(4)
    expect(departures[0].scheduledDepartureTime.toISOString()).to.equal('2025-03-28T20:48:00.000Z')
    expect(departures[0].estimatedDepartureTime.toISOString()).to.equal('2025-03-28T20:51:00.000Z')
    expect(departures[0].actualDepartureTime.toISOString()).to.equal('2025-03-28T20:51:00.000Z')

    expect(departures[0].runID).to.equal('2316')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.false
    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Camberwell')
    expect(departures[0].direction).to.equal('Up')
    expect(departures[0].viaCityLoop).to.be.false
    expect(departures[0].isSkippingLoop).to.be.null
    expect(departures[0].viaAltonaLoop).to.be.null
    expect(departures[0].isRailReplacementBus).to.be.false
    expect(departures[0].departureDay).to.equal('20250329')

    expect(departures[0].allStops[0]).to.equal('Alamein')
    expect(departures[0].allStops.slice(-1)[0]).to.equal('Camberwell')

    expect(departures[0].futureStops[0]).to.equal('Ashburton')
    expect(departures[0].futureStops.slice(-1)[0]).to.equal('Camberwell')

    expect(departures[3].scheduledDepartureTime.toISOString()).to.equal('2025-03-28T21:48:00.000Z')
    expect(departures[3].estimatedDepartureTime).to.be.null
    expect(departures[3].actualDepartureTime).to.equal(departures[3].scheduledDepartureTime)
  })
})