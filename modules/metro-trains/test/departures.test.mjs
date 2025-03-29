import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleLiveTrips from './sample-data/sample-live-trips.json' with { type: 'json' }
import sampleSchTrips from './sample-data/sample-sch-trips.json' with { type: 'json' }
import sampleSchMidnightNoDSTTrips from './sample-data/sample-sch-trips-mid-nodst.json' with { type: 'json' }
import alamein from './sample-data/alamein.json' with { type: 'json' }
import { fetchLiveTrips, fetchScheduledTrips } from '../get-departures.js'

const db = new LokiDatabaseConnection()
db.connect()
let gtfsTrips = await db.createCollection('gtfs timetables')
let liveTrips = await db.createCollection('live timetables')

await gtfsTrips.createDocuments(sampleSchTrips)
await liveTrips.createDocuments(sampleLiveTrips)

const midnightDBNoDST = new LokiDatabaseConnection()
midnightDBNoDST.connect()
await (await midnightDBNoDST.createCollection('gtfs timetables')).createDocuments(sampleSchMidnightNoDSTTrips)

describe('The fetchLiveTrips function', () => {
  it('Should return trip data from the live timetables collection', async () => {
    let trips = await fetchLiveTrips(alamein, db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)
  })
})

describe('The fetchScheduledTrips function', () => {
  it('Should return trip data from the gtfs timetables collection, with scheduled times to match the given departure day', async () => {
    let trips = await fetchScheduledTrips(alamein, db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T21:08:00.000Z') // 08:08
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T21:28:00.000Z') // 08:28
  })

  it('Should match trips across midnight', async () => {
    let trips = await fetchScheduledTrips(alamein, midnightDBNoDST, new Date('2025-03-29T12:40:00.000Z'))
    expect(trips.length).to.equal(3)

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T12:46:00.000Z') // 23:46
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T13:16:00.000Z') // 00:16 NEXT DAY
    expect(trips[2].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T14:14:00.000Z') // 01:14 NEXT DAY
  })

  it('Should match trips across to the next day', async () => {
    let trips = await fetchScheduledTrips(alamein, midnightDBNoDST, new Date('2025-03-29T15:10:00.000Z')) // 20250330 02:10 NEXT DAY from 20250329
    expect(trips.length).to.equal(2) // 02:16 and 03:18

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T15:16:00.000Z') // 02:16 NEXT DAY
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T16:18:00.000Z') // 03:16 NEXT PT DAY
  })
})