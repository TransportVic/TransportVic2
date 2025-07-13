import { expect } from 'chai'
import { MetroGTFSRTrip, ScheduledMetroGTFSRTrip, UnscheduledMetroGTFSRTrip } from '../../GTFSRTrip.mjs'
import { getUpcomingTrips } from '../metro-gtfsr-trips.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import lil3826 from './sample-data/lil-3826.json' with { type: 'json' }
import utils from '../../../../utils.js'
import { getOutdatedTrips } from '../metro-outdated-trips.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The Outdated trips tracker', () => {
  let originalNow
  before(() => {
    originalNow = utils.now
    utils.now = () => utils.parseTime(1749509580000) // 2025-06-09T22:53:00.000Z
  })

  it('Finds a list of active trips that have not been updated for 5 minutes', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let liveTimetables = await database.getCollection('live timetables')

    let trip = clone(lil3826)
    trip.lastUpdated = utils.now() - 1000 * 60 * 7 // Last updated 7 min ago
    await liveTimetables.createDocument(trip)

    let trip2 = clone(lil3826)
    trip2.runID = '3828'
    trip2.lastUpdated = utils.now() - 1000 * 60 * 3 // Last updated 3 min ago
    await liveTimetables.createDocument(trip2)

    let outdatedTDNs = await getOutdatedTrips(database)
    expect(outdatedTDNs).to.have.members(['3826'])
  })

  after(() => {
    utils.now = originalNow
  })
})