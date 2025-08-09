import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleSchTrips from '../../departures/sample-data/sample-sch-trips.json' with { type: 'json' }
import expectedStops from './sample-data/expected-stops.json' with { type: 'json' }
import expectedRoute from './sample-data/expected-routes.json' with { type: 'json' }
import { checkBusRegions, checkRoute, checkRouteOperators, checkStop, checkStopNumbers } from '../../../load-gtfs/health-check/check.mjs'

expectedStops.forEach(stop => stop.textQuery = ['A', 'B'])

let clone = o => JSON.parse(JSON.stringify(o))

const validDB = new LokiDatabaseConnection()
validDB.connect()
await (await validDB.createCollection('gtfs timetables')).createDocuments(clone(sampleSchTrips))
const validRoutes = await validDB.createCollection('routes')
const validStops = await validDB.createCollection('stops')
await validRoutes.createDocument(clone(expectedRoute))
await validStops.createDocuments(clone(expectedStops))

describe('The GTFS health check module', () => {
  describe ('The checkStop function', () => {
    it('Should fail if a stop is missing', async () => {
      const testDB1 = new LokiDatabaseConnection()
      testDB1.connect()
      const stops1 = await testDB1.createCollection('stops')
      await stops1.createDocuments(clone(expectedStops.filter(stop => !stop.stopName.startsWith('Flinders Street'))))

      expect(await checkStop(validStops, 'Flinders Street Railway Station', 'regional train')).to.not.exist
      expect(await checkStop(stops1, 'Flinders Street Railway Station', 'metro train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-stop',
        mode: 'metro train'
      })

      const testDB2 = new LokiDatabaseConnection()
      testDB2.connect()
      const stops2 = await testDB2.createCollection('stops')
      await stops2.createDocuments(clone(expectedStops.filter(stop => !stop.stopName.startsWith('Bendigo'))))

      expect(await checkStop(validStops, 'Bendigo Railway Station', 'regional train')).to.not.exist
      expect(await checkStop(stops2, 'Bendigo Railway Station', 'regional train')).to.deep.equal({
        stop: 'Bendigo Railway Station',
        reason: 'missing-stop',
        mode: 'regional train'
      })
    })

    it('Should fail if a bay in the test stop data is missing', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')
      let testStops = []
      for (let stop of clone(expectedStops)) {
        // Assume FSS somehow didn't load in metro stops but the stop still exists due to tram data
        if (stop.stopName.startsWith('Flinders Street')) stop.bays = stop.bays.filter(bay => bay.mode === 'tram')
        testStops.push(stop)
      }

      await stops.createDocuments(testStops)

      expect(await checkStop(validStops, 'Flinders Street Railway Station', 'metro train')).to.not.exist
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'metro train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-bay',
        mode: 'metro train'
      })
    })

    it('Should fail if a bay in the test stop data is missing service data', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')
      let testStops = []
      for (let stop of clone(expectedStops)) {
        stop.bays.forEach(bay => {
          bay.services = []
          bay.screenServices = []
        })
        testStops.push(stop)
      }

      await stops.createDocuments(testStops)

      expect(await checkStop(validStops, 'Flinders Street Railway Station', 'metro train')).to.not.exist
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'metro train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-bay-services',
        mode: 'metro train'
      })
    })

    it('Should fail if a tram stop in the test stop data is missing its TramTracker data', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')
      let testStops = []
      for (let stop of clone(expectedStops)) {
        stop.bays.forEach(bay => delete bay.tramTrackerID)
        testStops.push(stop)
      }

      await stops.createDocuments(testStops)

      expect(await checkStop(validStops, 'Flinders Street Railway Station', 'tram')).to.not.exist
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'metro train')).to.not.exist // Metro data should not be affected
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'tram')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-tramtracker-id',
        mode: 'tram'
      })
    })

    it('Should fail if a V/Line station in the test stop data is missing its VNet data', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')
      let testStops = []
      for (let stop of clone(expectedStops)) {
        stop.bays.forEach(bay => delete bay.vnetStationName)
        testStops.push(stop)
      }

      await stops.createDocuments(testStops)

      expect(await checkStop(validStops, 'Flinders Street Railway Station', 'regional train')).to.not.exist
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'metro train')).to.not.exist // Metro data should not be affected
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'regional train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-vnet-data',
        mode: 'regional train'
      })
    })

    it('Should fail if a stop does not have text query data', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')
      let testStops = []
      for (let stop of clone(expectedStops)) {
        delete stop.textQuery
        testStops.push(stop)
      }

      await stops.createDocuments(testStops)

      expect(await checkStop(validStops, 'Flinders Street Railway Station', 'regional train')).to.not.exist
      expect(await checkStop(stops, 'Flinders Street Railway Station', 'regional train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-text-query',
        mode: 'regional train'
      })
    })
  })

  describe('The checkStopNumbers function', () => {
    it('Should not fail if the stop is missing as it would already be picked up elsewhere', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')

      expect(await checkStopNumbers(validStops, 'Flinders Street Railway Station', 'tram')).to.not.exist
      expect(await checkStopNumbers(stops, 'Flinders Street Railway Station', 'tram')).to.not.exist
    })

    it('Should fail if a bay in the test stop data is missing its stop number', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const stops = await testDB.createCollection('stops')
      let testStops = []
      for (let stop of clone(expectedStops)) {
        stop.bays.forEach(bay => bay.stopNumber = null)
        testStops.push(stop)
      }

      await stops.createDocuments(testStops)

      expect(await checkStopNumbers(validStops, 'Flinders Street Railway Station', 'tram')).to.not.exist
      expect(await checkStopNumbers(stops, 'Flinders Street Railway Station', 'tram')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-stop-number',
        mode: 'tram'
      })
    })
  })

  describe('The checkRoute function', () => {
    it('Should fail if a route is missing', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const routes = await testDB.createCollection('routes')

      expect(await checkRoute(validRoutes, { routeGTFSID: '4-601' })).to.not.exist
      expect(await checkRoute(routes, { routeGTFSID: '4-601' })).to.deep.equal({
        query: { routeGTFSID: '4-601' },
        reason: 'missing-route'
      })
    })

    it('Should fail if a route is missing a route path', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const routes = await testDB.createCollection('routes')
      let testRoute = clone(expectedRoute)
      testRoute.routePath = []

      await routes.createDocument(testRoute)

      expect(await checkRoute(validRoutes, { routeGTFSID: '4-601' })).to.not.exist
      expect(await checkRoute(routes, { routeGTFSID: '4-601' })).to.deep.equal({
        query: { routeGTFSID: '4-601' },
        reason: 'missing-route-path',
        mode: 'bus'
      })
    })

    it('Should fail if a route is missing its route stops', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const routes = await testDB.createCollection('routes')
      let testRoute = clone(expectedRoute)
      testRoute.directions = []

      await routes.createDocument(testRoute)

      expect(await checkRoute(validRoutes, { routeGTFSID: '4-601' })).to.not.exist
      expect(await checkRoute(routes, { routeGTFSID: '4-601' })).to.deep.equal({
        query: { routeGTFSID: '4-601' },
        reason: 'missing-route-stops',
        mode: 'bus'
      })
    })
  })

  describe('The checkRouteOperators function', () => {
    it('Should identify any route with an unknown/default operator', async () => {
      const testDB = new LokiDatabaseConnection()
      testDB.connect()
      const routes = await testDB.createCollection('routes')
      let testRoute = clone(expectedRoute)

      let testRoute1 = clone(expectedRoute)
      testRoute1.operators = []
      testRoute1.routeGTFSID = '4-900'
      testRoute1.routeNumber = '900'

      let testRoute2 = clone(expectedRoute)
      testRoute2.operators = ['Unknown']
      testRoute2.routeGTFSID = '4-630'
      testRoute2.routeNumber = '630'

      await routes.createDocuments([ testRoute, testRoute1, testRoute2 ])

      expect(await checkRouteOperators(validRoutes)).to.deep.equal([])
      
      let testOutput = await checkRouteOperators(routes)
      expect(testOutput.find(route => route.routeGTFSID === '4-630')).to.exist
      expect(testOutput.find(route => route.routeGTFSID === '4-900')).to.exist
    })
  })

  describe('The checkBusRegions function', () => {
    it('Returns OK when all regions have routes assigned', () => {
      expect(checkBusRegions({
        "Melton": [{
          "routeGTFSID": "6-452",
          "routeNumber": "452",
          "liveTrack": true
        }],
        "Bacchus Marsh": [{
          "routeGTFSID": "6-BM3",
          "routeNumber": "433",
          "liveTrack": true
        }, {
          "routeGTFSID": "6-BM4",
          "routeNumber": "434",
          "liveTrack": true
        }],
      })).to.deep.equal({ status: 'ok' })
    })

    it('Returns OK for an empty input', () => {
      expect(checkBusRegions({})).to.deep.equal({ status: 'ok' })
      expect(checkBusRegions()).to.deep.equal({ status: 'ok' })
      expect(checkBusRegions(null)).to.deep.equal({ status: 'ok' })
    })

    it('Should identify any regional networks with no routes assigned', () => {
      expect(checkBusRegions({
        "Melton": [{
          "routeGTFSID": "6-452",
          "routeNumber": "452",
          "liveTrack": true
        }],
        "Bacchus Marsh": [],
      })).to.deep.equal({
        status: 'fail',
        failures: ['Bacchus Marsh']
      })
    })
  })
})