import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleLiveTrips from './sample-data/sample-live-trips.json' with { type: 'json' }
import sampleSchTrips from './sample-data/sample-sch-trips.json' with { type: 'json' }
import sampleSchMidnightNoDSTTrips from './sample-data/sample-sch-trips-mid-nodst.json' with { type: 'json' }

import sampleLiveMidnightNoDSTTrips from './sample-data/sample-live-trips-mid-nodst.json' with { type: 'json' }
import sampleLiveCCLTrips from './sample-data/sample-live-trips-ccl.json' with { type: 'json' }

import sample682 from './sample-data/sample-682.json' with { type: 'json' }
import studPark from './sample-data/stud-park.json' with { type: 'json' }

import flindersStreet from './sample-data/flinders-street.json' with { type: 'json' }
import alamein from './sample-data/alamein.json' with { type: 'json' }
import { fetchLiveTrips, fetchScheduledTrips, getDepartures, getCombinedDepartures, shouldUseLiveDepartures } from '../get-departures.js'
import utils from '../../../utils.js'

let clone = o => JSON.parse(JSON.stringify(o))

const db = new LokiDatabaseConnection()
db.connect()
await (await db.createCollection('gtfs timetables')).createDocuments(clone(sampleSchTrips))
await (await db.createCollection('live timetables')).createDocuments(clone(sampleLiveTrips))

const midnightDBNoDST = new LokiDatabaseConnection()
midnightDBNoDST.connect()
await (await midnightDBNoDST.createCollection('gtfs timetables')).createDocuments(clone(sampleSchMidnightNoDSTTrips))
await (await midnightDBNoDST.createCollection('live timetables')).createDocuments(clone(sampleLiveMidnightNoDSTTrips))

const cclDB = new LokiDatabaseConnection()
cclDB.connect()
await (await cclDB.createCollection('gtfs timetables')).createDocuments(clone(sampleLiveCCLTrips))
await (await cclDB.createCollection('live timetables')).createDocuments(clone(sampleLiveCCLTrips))

const studDB = new LokiDatabaseConnection()
studDB.connect()
await (await studDB.createCollection('live timetables')).createDocuments(clone(sample682))

describe('The fetchLiveTrips function', () => {
  it('Should return trip data from the live timetables collection', async () => {
    let trips = await fetchLiveTrips(alamein, 'metro train', db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)
  })
})

describe('The fetchScheduledTrips function', () => {
  it('Should return trip data from the gtfs timetables collection, with scheduled times to match the given departure day', async () => {
    let trips = await fetchScheduledTrips(alamein, 'metro train', db, new Date('2025-03-28T21:00:00.000Z'))
    expect(trips.length).to.equal(3)

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T21:08:00.000Z') // 08:08
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T21:28:00.000Z') // 08:28
  })

  it('Should match trips across midnight', async () => {
    let trips = await fetchScheduledTrips(alamein, 'metro train', midnightDBNoDST, new Date('2025-03-29T12:40:00.000Z'))
    expect(trips.length).to.equal(3)

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T12:46:00.000Z') // 23:46
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T13:16:00.000Z') // 00:16 NEXT DAY
    expect(trips[2].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T14:14:00.000Z') // 01:14 NEXT DAY
  })

  it('Should match trips across to the next day', async () => {
    let trips = await fetchScheduledTrips(alamein, 'metro train', midnightDBNoDST, new Date('2025-03-29T15:10:00.000Z')) // 20250330 02:10 NEXT DAY from 20250329
    expect(trips.length).to.equal(2) // 02:16 and 03:18

    expect(trips[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T15:16:00.000Z') // 02:16 NEXT DAY
    expect(trips[1].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-29T16:18:00.000Z') // 03:16 NEXT PT DAY
  })
})

describe('The shouldUseLiveDepartures function', () => {
  it('Should return true for a departure today', () => {
    expect(shouldUseLiveDepartures(utils.now())).to.be.true
  })

  it('Should return true for a departure at 8am tomorrow', () => {
    expect(shouldUseLiveDepartures(utils.now().startOf('day').add(1, 'day').add('8', 'hours'))).to.be.true
  })

  it('Should return false for a departure at 8am the day after', () => {
    expect(shouldUseLiveDepartures(utils.now().startOf('day').add(2, 'day').add('8', 'hours'))).to.be.false
  })

  it('Should return true for a departure at 2am tomorrow', () => {
    expect(shouldUseLiveDepartures(utils.now().startOf('day').add(1, 'day').add('2', 'hours'))).to.be.true
  })

  it('Should return true for a departure before today', () => {
    expect(shouldUseLiveDepartures(utils.now().startOf('day').add(-1, 'day'))).to.be.true
    expect(shouldUseLiveDepartures(utils.now().startOf('day').add(-50, 'day'))).to.be.true
  })
})

describe('The getCombinedDepartures function', () => {
  it('Should return live departures for departure times in the past', async () => {
    let departures = await getCombinedDepartures(alamein, 'metro train', db, { departureTime: new Date('2025-03-28T20:50:00.000Z'), timeframe: 10 })
    expect(departures.length).to.equal(1)
    expect(departures[0].stopTimings[0].scheduledDepartureTime).to.equal('2025-03-28T20:48:00.000Z')
    expect(departures[0].stopTimings[0].estimatedDepartureTime).to.equal('2025-03-28T20:51:00.000Z')
    expect(departures[0].departureTime).to.equal('07:48')
    expect(departures[0]._live).to.exist
  })

  it('Should return scheduled departures for departure times in the future on a different day', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-25T20:45:00.000Z') // current time is 24 march

    // fetch for 29 march
    let departures = await getCombinedDepartures(alamein, 'metro train', db, { departureTime: new Date('2025-03-28T20:45:00.000Z'), timeframe: 10 })
    expect(departures.length).to.equal(1)
    expect(departures[0].departureTime).to.equal('07:48')
    expect(departures[0]._live).to.not.exist

    utils.now = originalNow
  })

  it('Should return live departures for departure times in the future on the same day', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-28T20:00:00.000Z') // current time is 29 march 7am

    // fetch for 29 march 7.45am
    let departures = await getCombinedDepartures(alamein, 'metro train', db, { departureTime: new Date('2025-03-28T20:45:00.000Z'), timeframe: 10 })
    expect(departures.length).to.equal(1)
    expect(departures[0].departureTime).to.equal('07:48')
    expect(departures[0]._live).to.exist

    utils.now = originalNow
  })

  it('Should return live departures for departure times before 3am on the next day', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-28T20:00:00.000Z') // current time is 29 march 7am

    // fetch for 30 march 1.10am (same PT day)
    let departures = await getCombinedDepartures(alamein, 'metro train', midnightDBNoDST, { departureTime: new Date('2025-03-29T14:10:00.000Z'), timeframe: 10 })
    expect(departures.length).to.equal(1)
    expect(departures[0].departureTime).to.equal('25:14')
    expect(departures[0].stopTimings[0].departureTime).to.equal('01:14')
    expect(departures[0]._live).to.exist

    utils.now = originalNow
  })

  it('Should return a mix of live and scheduled departures for departure times crossing the next PT day and the subsequent PT day', async () => {
    let originalNow = utils.now
    utils.now = () => utils.parseTime('2025-03-27T20:00:00.000Z') // current time is 28 march 7am

    // fetch for 30 march 1.10am (end of next PT day), should include departures for 30 march 3am (subsequent PT day)
    let departures = await getCombinedDepartures(alamein, 'metro train', midnightDBNoDST, { departureTime: new Date('2025-03-29T14:10:00.000Z'), timeframe: 180 })

    expect(departures.length).to.equal(3)
    expect(departures[0].stopTimings[0].departureTime).to.equal('01:14')
    expect(departures[0]._live).to.exist

    expect(departures[1].stopTimings[0].departureTime).to.equal('02:16')
    expect(departures[1]._live).to.exist

    expect(departures[2].stopTimings[0].departureTime).to.equal('03:18')
    expect(departures[2]._live).to.not.exist

    utils.now = originalNow
  })
})

describe('The getDepartures function', () => {
  it('Should return appropriate data for each departure', async () => {
    let departures = await getDepartures(alamein, 'metro train', db, { departureTime: new Date('2025-03-28T20:40:00.000Z'), timeframe: 120 })

    expect(departures.length).to.equal(4)

    expect(departures[0].scheduledDepartureTime.toISOString()).to.equal('2025-03-28T20:48:00.000Z')
    expect(departures[0].estimatedDepartureTime.toISOString()).to.equal('2025-03-28T20:51:00.000Z')
    expect(departures[0].actualDepartureTime.toISOString()).to.equal('2025-03-28T20:51:00.000Z')
    expect(departures[0].cancelled).to.be.false

    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Camberwell Railway Station')

    expect(departures[0].departureDay).to.equal('20250329')

    expect(departures[0].allStops[0]).to.equal('Alamein Railway Station')
    expect(departures[0].allStops.slice(-1)[0]).to.equal('Camberwell Railway Station')

    expect(departures[0].futureStops[0]).to.equal('Ashburton Railway Station')
    expect(departures[0].futureStops.slice(-1)[0]).to.equal('Camberwell Railway Station')

    expect(departures[3].scheduledDepartureTime.toISOString()).to.equal('2025-03-28T21:48:00.000Z')
    expect(departures[3].estimatedDepartureTime).to.be.null
    expect(departures[3].actualDepartureTime).to.equal(departures[3].scheduledDepartureTime)
  })

  it('Should duplicate a departure to show it servicing a stop more than once', async () => {
    let departures = await getDepartures(studPark, 'bus', studDB, { departureTime: new Date('2025-03-30T05:05:00.000Z'), timeframe: 120 })

    expect(departures.length).to.equal(2, 'Stops served under 2 minutes should not be duplicated')
    expect(departures[0].scheduledDepartureTime.toISOString()).to.equal('2025-03-30T05:18:00.000Z')
    expect(departures[1].scheduledDepartureTime.toISOString()).to.equal('2025-03-30T06:07:00.000Z')
  })

  it('Should not duplicate the final stop', async () => {
    let departures = await getDepartures(flindersStreet, 'metro train', cclDB, { departureTime: new Date('2025-04-04T18:29:00.000Z'), timeframe: 120 })

    expect(departures.length).to.equal(1)
    expect(departures[0].scheduledDepartureTime.toISOString()).to.equal('2025-04-04T18:30:00.000Z')
  })

  it('Should not duplicate the first stop if it already passed', async () => {
    let departures = await getDepartures(flindersStreet, 'metro train', cclDB, { departureTime: new Date('2025-04-04T18:39:00.000Z'), timeframe: 120 })
    expect(departures.length).to.equal(0)
  })
})