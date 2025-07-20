import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import allStops from '../../op-timetable/test/sample-data/stops.json' with { type: 'json' }
import allRoutes from '../../op-timetable/test/sample-data/routes.json' with { type: 'json' }
import td8741 from './sample-data/td8741-live.json' with { type: 'json' }
import VLineTripUpdater from '../trip-updater.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The V/Line Trip Updater', () => {
  describe('The updateTripDestination function', () => {
    it('Does nothing if the destination is unchanged', async () => {
      let database = new LokiDatabaseConnection()
      let stops = database.getCollection('stops')
      let routes = database.getCollection('routes')
      let timetables = database.getCollection('live timetables')

      await stops.createDocuments(clone(allStops))
      await routes.createDocuments(clone(allRoutes))
      await timetables.createDocument(clone(td8741))

      let trip = await VLineTripUpdater.updateTripDestination(database, '20250718', '8741', 'Waurn Ponds Railway Station')
      expect(trip.runID).to.equal('8741')

      for (let i = 0; i < trip.stops.length; i++) expect(trip.stops[i].cancelled).to.be.false
    })

    it('Can terminate a trip early at a specified station', async () => {
      let database = new LokiDatabaseConnection()
      let stops = database.getCollection('stops')
      let routes = database.getCollection('routes')
      let timetables = database.getCollection('live timetables')

      await stops.createDocuments(clone(allStops))
      await routes.createDocuments(clone(allRoutes))
      await timetables.createDocument(clone(td8741))

      let trip = await VLineTripUpdater.updateTripDestination(database, '20250718', '8741', 'Tarneit Railway Station')
      expect(trip.runID).to.equal('8741')

      for (let i = 0; i <= 4; i++) expect(trip.stops[i].cancelled).to.be.false
      for (let i = 5; i < trip.stops.length; i++) expect(trip.stops[i].cancelled).to.be.true
    })

    it('Can re extend a trip back after it was terminated', async () => {
      let database = new LokiDatabaseConnection()
      let stops = database.getCollection('stops')
      let routes = database.getCollection('routes')
      let timetables = database.getCollection('live timetables')

      await stops.createDocuments(clone(allStops))
      await routes.createDocuments(clone(allRoutes))
      await timetables.createDocument(clone(td8741))

      let trip = await VLineTripUpdater.updateTripDestination(database, '20250718', '8741', 'Tarneit Railway Station')
      expect(trip.runID).to.equal('8741')

      for (let i = 0; i <= 4; i++) expect(trip.stops[i].cancelled).to.be.false
      for (let i = 5; i < trip.stops.length; i++) expect(trip.stops[i].cancelled).to.be.true

      trip = await VLineTripUpdater.updateTripDestination(database, '20250718', '8741', 'South Geelong Railway Station')
      expect(trip.runID).to.equal('8741')

      for (let i = 0; i <= 11; i++) expect(trip.stops[i].cancelled).to.be.false
      for (let i = 12; i < trip.stops.length; i++) expect(trip.stops[i].cancelled).to.be.true
    })
  })
})