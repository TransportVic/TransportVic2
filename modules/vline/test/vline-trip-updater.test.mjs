import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import allStops from '../../op-timetable/test/sample-data/stops.json' with { type: 'json' }
import allRoutes from '../../op-timetable/test/sample-data/routes.json' with { type: 'json' }
import td8741 from './sample-data/td8741-live.json' with { type: 'json' }
import VLineTripUpdater from '../trip-updater.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The V/Line Trip Updater', () => {
  it('Can terminate a trip early at a specified station', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await timetables.createDocument(clone(td8741))

    VLineTripUpdater.terminateTripEarly(database, '20250718', '8741', 'Tarneit Railway Station')

    let trip = await timetables.findDocument({})
    expect(trip.runID).to.equal('8741')

    for (let i = 0; i <= 4; i++) expect(trip.stopTimings[i].cancelled).to.be.false
    for (let i = 5; i < trip.stopTimings.length; i++) expect(trip.stopTimings[i].cancelled).to.be.true
  })
})