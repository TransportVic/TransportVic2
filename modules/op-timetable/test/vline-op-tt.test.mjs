import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { GetPlatformServicesAPI, VLinePlatformService, VLinePlatformServices } from '@transportme/ptv-api/lib/vline/get-platform-services.mjs'
import { downloadTripPattern, matchTrip } from '../load-vline-op-tt.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import td8741GTFS from './sample-data/td8741-gtfs.json' with { type: 'json' }
import td8007NSP from './sample-data/td8007-nsp.json' with { type: 'json' }
import allStops from './sample-data/stops.json' with { type: 'json' }
import allRoutes from './sample-data/routes.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const vlineTrips = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips.xml'))).toString()
const td8007Early = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-early-pattern.xml'))).toString()
const td8007Late = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-late-pattern.xml'))).toString()
const td8741 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8741-pattern.xml'))).toString()

const clone = o => JSON.parse(JSON.stringify(o))

describe('The matchTrip function', () => {
  it('Matches a V/Line API trip to a GTFS trip', async () => {
    let database = new LokiDatabaseConnection()
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let stops = database.getCollection('stops')

    await gtfsTimetables.createDocument(clone(td8741GTFS))
    await stops.createDocument(clone(allStops))

    let stubAPI = new StubVLineAPI()
      stubAPI.setResponses([ vlineTrips ])
      let ptvAPI = new PTVAPI(stubAPI)
      ptvAPI.addVLine(stubAPI)

      let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 30)

      expect(departures[0]).to.be.instanceOf(VLinePlatformService)
      expect(departures[0].origin).to.equal('Melbourne, Southern Cross')
      expect(departures[0].destination).to.equal('Waurn Ponds Station')
      expect(departures[0].tdn).to.equal('8741')
      expect(departures[0].departureTime.toUTC().toISO()).to.equal('2025-07-18T01:30:00.000Z')
      expect(departures[0].arrivalTime.toUTC().toISO()).to.equal('2025-07-18T02:48:00.000Z')

      let matchingTrip = await matchTrip('20250718', departures[0], database)
      expect(matchingTrip).to.exist
      expect(matchingTrip.tripID).to.equal('48.T0.1-GEL-mjp-8.11.H')
  })

  it('Fetches trip details from the V/Line API if the trip is unknown', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
      stubAPI.setResponses([ vlineTrips, td8741 ])
      let ptvAPI = new PTVAPI(stubAPI)
      ptvAPI.addVLine(stubAPI)

      let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 30)

      expect(departures[0]).to.be.instanceOf(VLinePlatformService)
      expect(departures[0].tdn).to.equal('8741')

      let matchingTrip = await matchTrip('20250718', departures[0], database)
      expect(matchingTrip).to.not.exist

      let pattern = await downloadTripPattern('Fri', '20250718', departures[0], database)
      let trip = pattern.toDatabase()
      expect(trip.runID).to.equal('8741')
      expect(trip.direction).to.equal('Down')

      expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
      expect(trip.stopTimings[0].departureTime).to.equal('11:30')

      expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
      expect(trip.stopTimings[1].departureTime).to.equal('11:38')
  })

  it('Cross references the NSP to handle trips with duplicated stops (late trip)', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await timetables.createDocument(clone(td8007NSP))

    let stubAPI = new StubVLineAPI()
      stubAPI.setResponses([ vlineTrips, td8007Late ])
      let ptvAPI = new PTVAPI(stubAPI)
      ptvAPI.addVLine(stubAPI)

      let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 30)

      expect(departures[1]).to.be.instanceOf(VLinePlatformService)
      expect(departures[1].tdn).to.equal('8007')

      let matchingTrip = await matchTrip('20250726', departures[1], database)
      expect(matchingTrip).to.not.exist

      let pattern = await downloadTripPattern('Sat', '20250726', departures[1], database)
      let trip = pattern.toDatabase()
      expect(trip.runID).to.equal('8007')
      expect(trip.direction).to.equal('Down')

      expect(trip.stopTimings[0].stopName).to.equal('Gisborne Railway Station')
      expect(trip.stopTimings[0].departureTime).to.equal('08:13')

      expect(trip.stopTimings[1].stopName).to.equal('Macedon Railway Station')
      expect(trip.stopTimings[1].arrivalTime).to.equal('08:17')
      expect(trip.stopTimings[1].departureTime).to.equal('08:17')
  })

  it('Cross references the NSP to handle trips with duplicated stops (early trip)', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await timetables.createDocument(clone(td8007NSP))

    let stubAPI = new StubVLineAPI()
      stubAPI.setResponses([ vlineTrips, td8007Early ])
      let ptvAPI = new PTVAPI(stubAPI)
      ptvAPI.addVLine(stubAPI)

      let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 30)

      expect(departures[2]).to.be.instanceOf(VLinePlatformService)
      expect(departures[2].tdn).to.equal('8007')

      let matchingTrip = await matchTrip('20250726', departures[2], database)
      expect(matchingTrip).to.not.exist

      let pattern = await downloadTripPattern('Sat', '20250726', departures[2], database)
      let trip = pattern.toDatabase()
      expect(trip.runID).to.equal('8007')
      expect(trip.direction).to.equal('Down')

      expect(trip.stopTimings[0].stopName).to.equal('Gisborne Railway Station')
      expect(trip.stopTimings[0].departureTime).to.equal('07:45')

      expect(trip.stopTimings[1].stopName).to.equal('Macedon Railway Station')
      expect(trip.stopTimings[1].arrivalTime).to.equal('07:50')
      expect(trip.stopTimings[1].departureTime).to.equal('07:50')
  })
})