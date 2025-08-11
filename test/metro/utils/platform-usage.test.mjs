import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { getPlatformUsage } from '../../../modules/metro-trains/platform-usage.mjs'
import pkmStopsDB from '../tracker/sample-data/pkm-stops-db.json' with { type: 'json' }
import ephTrips from './sample-data/eph-trips.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The platform usage function', () => {
  it.only('Returns a list of times that trains sit on the platforms for', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let timetables = database.getCollection('live timetables')
    await stops.createDocument(clone(pkmStopsDB))
    await timetables.createDocument(clone(ephTrips))

    let eph = await stops.findDocument({ stopName: "East Pakenham Railway Station" })

    let platformUsage = await getPlatformUsage(database, eph, new Date('2025-08-11T01:48:00.000Z'))

    let dwell_4043_4070 = platformUsage.find(dwell => dwell.runID === '4043')
    let dwell_4045_4072 = platformUsage.find(dwell => dwell.runID === '4045')

    expect(dwell_4043_4070.start.toISOString()).to.equal('2025-08-11T01:27:00.000Z') // 11:27
    expect(dwell_4043_4070.end.toISOString()).to.equal('2025-08-11T01:43:00.000Z') // 11:43

    expect(dwell_4045_4072.start.toISOString()).to.equal('2025-08-11T01:47:00.000Z') // 11:27
    expect(dwell_4045_4072.end.toISOString()).to.equal('2025-08-11T02:03:00.000Z') // 11:43
  })
})