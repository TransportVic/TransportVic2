import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import lil3826 from './sample-data/lil-3826.json' with { type: 'json' }
import cbeC406 from './sample-data/cbe-C406.json' with { type: 'json' }
import utils from '../../../utils.mjs'
import { getOutdatedTrips } from '../../../modules/new-tracker/metro/metro-outdated-trips.mjs'
import steamTD8543 from './sample-data/steam-td8543.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The Outdated trips tracker', () => {
  let originalNow
  before(() => {
    originalNow = utils.now
    utils.now = () => utils.parseTime(1749509580000) // 2025-06-09T22:53:00.000Z
  })

  it('Finds a list of active trips that have not been updated for 2 minutes', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let liveTimetables = await database.getCollection('live timetables')

    let trip = clone(lil3826)
    trip.lastUpdated = utils.now() - 1000 * 60 * 7 // Last updated 7 min ago
    await liveTimetables.createDocument(trip)

    let trip2 = clone(lil3826)
    trip2.runID = '3828'
    trip2.lastUpdated = utils.now() - 1000 * 60 * 1 // Last updated 1 min ago
    await liveTimetables.createDocument(trip2)

    let trip3 = clone(cbeC406)
    trip3.lastUpdated = 1749420960000 // 2025-06-08T22:15:00.000Z, a whole day before
    await liveTimetables.createDocument(trip3)

    let outdatedTDNs = await getOutdatedTrips(database)
    expect(outdatedTDNs).to.have.members(['3826'])
  })

  it('Should not pick future trips that have not started yet', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let liveTimetables = await database.getCollection('live timetables')

    let trip = clone(lil3826)
    trip.lastUpdated = utils.now() - 1000 * 60 * 7 // Last updated 7 min ago
    trip.stopTimings.forEach(stop => stop.actualDepartureTimeMS += 1000 * 60 * 60 * 2) // trip is 2 hours away
    await liveTimetables.createDocument(trip)

    let outdatedTDNs = await getOutdatedTrips(database)
    expect(outdatedTDNs).to.have.members([])
  })

  it('Should not pick Stony Point trips as PTV wouldn\'t have them', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let liveTimetables = await database.getCollection('live timetables')

    let trip = clone(lil3826)
    trip.routeGTFSID = '2-STY'
    trip.routeName = 'Stony Point'
    trip.runID = '8500'
    trip.lastUpdated = utils.now() - 1000 * 60 * 7 // Last updated 7 min ago
    await liveTimetables.createDocument(trip)

    let trip1 = clone(lil3826)
    trip1.lastUpdated = utils.now() - 1000 * 60 * 7 // Last updated 7 min ago
    await liveTimetables.createDocument(trip1)

    let outdatedTDNs = await getOutdatedTrips(database)
    expect(outdatedTDNs).to.have.members([ '3826' ])
  })

  it('Picks up non STY 8XXX TDNs that are not manually loaded', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let liveTimetables = await database.getCollection('live timetables')
    utils.now = () => utils.parseTime(1755391581688) // 10.46am

    let trip = clone(steamTD8543) // Trip last updated at 10.32am
    await liveTimetables.createDocument(trip)

    let outdatedTDNs = await getOutdatedTrips(database)
    expect(outdatedTDNs).to.have.members(['8543'])
  })

  after(() => {
    utils.now = originalNow
  })
})