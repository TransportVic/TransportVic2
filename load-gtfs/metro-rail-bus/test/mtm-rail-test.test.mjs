import { LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import { expect } from 'chai'
import MTMRailRouteLoader from '../loaders/MTMRailRouteLoader.mjs'
import MTMRailStopLoader from '../loaders/MTMRailStopLoader.mjs'
import MTMRailTripLoader from '../loaders/MTMRailTripLoader.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const agencyFile = path.join(__dirname, 'sample-data', 'agency.txt')

const calendarFile = path.join(__dirname, 'sample-data', 'calendar.txt')

const routesFile = path.join(__dirname, 'sample-data', 'routes.txt')

const stopTimesFile = path.join(__dirname, 'sample-data', 'stop_times.txt')
const tripsFile = path.join(__dirname, 'sample-data', 'trips.txt')
const stopsFile = path.join(__dirname, 'sample-data', 'stops.txt')

describe('The GTFS Loaders with the MTM Website Rail data', () => {
  describe('The stop loader', () => {
    it('Changes "Fed Square" to Flinders Street', async () => {
      let database = new LokiDatabaseConnection('test-db')
      let stops = await database.createCollection('stops')

      let stopLoader = new MTMRailStopLoader(stopsFile, database)
      await stopLoader.loadStops()

      let fss = await stops.findDocument({ 
        'bays.stopGTFSID': 'RAIL_FSS_Up'
      })

      expect(fss).to.exist
      expect(fss.stopName).to.equal('Flinders Street Railway Station')
    })
  })

  describe('The route loader', () => {
    it('Should convert all route IDs into one 2-RRB route', async () => {
      let database = new LokiDatabaseConnection('test-db')
      let routes = await database.createCollection('routes')

      let routeLoader = new MTMRailRouteLoader(routesFile, agencyFile, database)
      await routeLoader.loadRoutes()

      let railBus = await routes.findDocument({ routeGTFSID: '2-RRB' })

      expect(railBus).to.exist
      expect(railBus.routeName).to.equal('Rail Replacement Bus')
    })
  })

  describe('The trip loader', () => {
    it('Is able to ingest trip data', async () => {
      let database = new LokiDatabaseConnection('test-db')
      let stops = await database.createCollection('stops')
      let routes = await database.createCollection('routes')
      let trips = await database.createCollection('gtfs timetables')

      let stopLoader = new MTMRailStopLoader(stopsFile, database)
      await stopLoader.loadStops()

      let routeLoader = new MTMRailRouteLoader(routesFile, agencyFile, database)
      await routeLoader.loadRoutes()

      let tripLoader = new MTMRailTripLoader({
        tripsFile, stopTimesFile,
        calendarFile
      }, database)

      await tripLoader.loadTrips(routeLoader.getRouteIDMap())

      let donricTrip = await trips.findDocument({
        operationDays: '20250616',
        origin: 'Moorabbin Railway Station',
        departureTime: '24:13'
      })

      expect(donricTrip).to.not.be.null
      expect(donricTrip.tripID).to.equal('Mon - Wed_0416t91')
      expect(donricTrip.routeGTFSID).to.equal('2-RRB')
      expect(donricTrip.block).to.equal('DON604')
      expect(donricTrip.isRailReplacementBus).to.be.true

      expect(donricTrip.stopTimings[0].stopConditions.pickup).to.equal(0)
      expect(donricTrip.direction).to.equal('Up')

      let dysonsTrip = await trips.findDocument({
        operationDays: '20250616',
        origin: 'Werribee Railway Station',
        departureTime: '20:22'
      })

      expect(dysonsTrip).to.not.be.null
      expect(dysonsTrip.tripID).to.equal('46332')
      expect(dysonsTrip.routeGTFSID).to.equal('2-RRB')
      expect(dysonsTrip.block).to.equal('51')
      expect(dysonsTrip.isRailReplacementBus).to.be.true
      expect(donricTrip.direction).to.equal('Up')

      let WTL_BEW = await trips.findDocument({
        operationDays: '20250616',
        origin: 'Moorabbin Railway Station',
        departureTime: '24:13'
      })

      expect(WTL_BEW).to.not.be.null
      expect(WTL_BEW.tripID).to.equal('Sat_ugie8q4')
      expect(WTL_BEW.routeGTFSID).to.equal('2-RRB')
      expect(WTL_BEW.block).to.equal('WIL501')
      expect(WTL_BEW.isRailReplacementBus).to.be.true
      expect(WTL_BEW.direction).to.equal('Down')
    })
  })
})