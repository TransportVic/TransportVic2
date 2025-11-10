import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { GetPlatformServicesAPI, VLinePlatformService } from '@transportme/ptv-api/lib/vline/get-platform-services.mjs'
import loadOperationalTT, { downloadTripPattern, matchTrip } from '../../../modules/op-timetable/load-vline-op-tt.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import td8741GTFS from './sample-data/td8741-gtfs.json' with { type: 'json' }
import td8891Live from './sample-data/time-change/td8891-live.json' with { type: 'json' }
import td8891GTFS from './sample-data/time-change/td8891-gtfs.json' with { type: 'json' }
import td8007NSP from './sample-data/td8007-nsp.json' with { type: 'json' }
import allStops from './sample-data/stops.json' with { type: 'json' }
import allRoutes from './sample-data/routes.json' with { type: 'json' }
import VLineUtils from '../../../modules/vline/vline-utils.mjs'
import utils from '../../../utils.js'
import td8457GTFS from './sample-data/td8457-gtfs.mjs'
import dstStartNo2amTripsGTFS from './sample-data/dst-start-no2am-trips.mjs'
import td8469Live from './sample-data/td8469-live.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const vlineTripsTD8457 = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips-td8457.xml'))).toString()
const td8457 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8457-pattern.xml'))).toString()

const vlineTripsTD8741_Normal = (await fs.readFile(path.join(__dirname, 'sample-data', 'alterations', 'td8741-normal.xml'))).toString()
const vlineTripsTD8741_Geelong = (await fs.readFile(path.join(__dirname, 'sample-data', 'alterations', 'td8741-terminate-geelong.xml'))).toString()

const vlineTripsTD8891_Normal = (await fs.readFile(path.join(__dirname, 'sample-data', 'time-change', 'td8891-2235.xml'))).toString()
const vlineTripsTD8891_Late = (await fs.readFile(path.join(__dirname, 'sample-data', 'time-change', 'td8891-2250.xml'))).toString()

const vlineTripsEmpty = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips-empty.xml'))).toString()

const vlineTrips = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips.xml'))).toString()
const td8007Early = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-early-pattern.xml'))).toString()
const td8007Late = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-late-pattern.xml'))).toString()
const td8741 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8741-pattern.xml'))).toString()

const dstStartTripSat = (await fs.readFile(path.join(__dirname, 'sample-data', 'dst-start-no2am-sat.xml'))).toString()
const dstStartTripSun = (await fs.readFile(path.join(__dirname, 'sample-data', 'dst-start-no2am-sun.xml'))).toString()

const vlineTripsTD8469_WTL = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips-td8469-wtl.xml'))).toString()

const clone = o => JSON.parse(JSON.stringify(o))

describe('The matchTrip function', () => {
  it('Matches a V/Line API trip to a GTFS trip', async () => {
    let database = new LokiDatabaseConnection()
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let stops = database.getCollection('stops')

    await gtfsTimetables.createDocument(clone(td8741GTFS))
    await stops.createDocuments(clone(allStops))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTrips, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 30)

    expect(departures[0]).to.be.instanceOf(VLinePlatformService)
    expect(departures[0].origin).to.equal('Melbourne, Southern Cross')
    expect(departures[0].destination).to.equal('Waurn Ponds Station')
    expect(departures[0].tdn).to.equal('8741')
    expect(departures[0].departureTime.toUTC().toISO()).to.equal('2025-07-18T01:30:00.000Z')
    expect(departures[0].arrivalTime.toUTC().toISO()).to.equal('2025-07-18T02:48:00.000Z')

    let matchingTrip = await matchTrip('20250718', utils.parseDate('20250718'), departures[0], database)
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

    let matchingTrip = await matchTrip('20250718', utils.parseDate('20250718'), departures[0], database)
    expect(matchingTrip).to.not.exist

    let pattern = await downloadTripPattern('20250718', departures[0], null, database)
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

    let matchingTrip = await matchTrip('20250726', utils.parseDate('20250726'), departures[1], database)
    expect(matchingTrip).to.not.exist

    let nspTrip = await VLineUtils.getNSPTrip('Sat', departures[2].tdn, database)
    let pattern = await downloadTripPattern('20250726', departures[2], nspTrip, database)
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

    let matchingTrip = await matchTrip('20250726', utils.parseDate('20250726'), departures[2], database)
    expect(matchingTrip).to.not.exist

    let nspTrip = await VLineUtils.getNSPTrip('Sat', departures[2].tdn, database)
    let pattern = await downloadTripPattern('20250726', departures[2], nspTrip, database)
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

describe('The loadOperationalTT function', () => {
  it('Loads the operational timetable in', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8741_Normal, vlineTripsEmpty, td8741 ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20250718'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8741')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('11:30')
    expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('11:38')
  })

  it('Reuses trips where available', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8741_Normal, vlineTripsEmpty, td8741, vlineTripsTD8741_Normal, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    // Call twice, should only fetch from API once
    await loadOperationalTT(database, database, utils.parseDate('20250718'), ptvAPI)
    await loadOperationalTT(database, database, utils.parseDate('20250718'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8741')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('11:30')
    expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('11:38')
  })

  it('Shorts a trip when altered', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8741_Normal, vlineTripsEmpty, td8741, vlineTripsTD8741_Geelong, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20250718'), ptvAPI)
    await loadOperationalTT(database, database, utils.parseDate('20250718'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8741')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('11:30')
    expect(trip.stopTimings[0].cancelled).to.be.false

    expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('11:38')
    expect(trip.stopTimings[1].cancelled).to.be.false

    expect(trip.stopTimings[11].stopName).to.equal('South Geelong Railway Station')
    expect(trip.stopTimings[11].departureTime).to.equal('12:37')
    expect(trip.stopTimings[11].cancelled).to.be.true
  })

  it('Updates the trip timing when an existing TDN matches but the times have been shifted', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await timetables.createDocument(clone(td8891Live))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8891_Normal, vlineTripsEmpty, vlineTripsTD8891_Late, vlineTripsEmpty, vlineTripsTD8891_Late, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20250719'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8891')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('22:35')
    expect(trip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('22:58')
    expect(trip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(trip.stopTimings[8].departureTime).to.equal('23:40')

    await loadOperationalTT(database, database, utils.parseDate('20250719'), ptvAPI)
    let updatedTrip = await timetables.findDocument({})

    expect(updatedTrip.runID).to.equal('8891')
    expect(updatedTrip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(updatedTrip.stopTimings[0].departureTime).to.equal('22:50')
    expect(updatedTrip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(updatedTrip.stopTimings[1].departureTime).to.equal('23:13')
    expect(updatedTrip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(updatedTrip.stopTimings[8].departureTime).to.equal('23:55')

    // Further updates should not change the time any more
    await loadOperationalTT(database, database, utils.parseDate('20250719'), ptvAPI)
    let update2Trip = await timetables.findDocument({})

    expect(update2Trip.runID).to.equal('8891')
    expect(update2Trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(update2Trip.stopTimings[0].departureTime).to.equal('22:50')
    expect(update2Trip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(update2Trip.stopTimings[1].departureTime).to.equal('23:13')
    expect(update2Trip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(update2Trip.stopTimings[8].departureTime).to.equal('23:55')
  })

  it('Matches a trip where the times are updated before any live trip is created', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let liveTimetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await gtfsTimetables.createDocument(clone(td8891GTFS))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8891_Late, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    // Go direct to altered times
    await loadOperationalTT(database, database, utils.parseDate('20250719'), ptvAPI)
    let updatedTrip = await liveTimetables.findDocument({})

    expect(updatedTrip.runID).to.equal('8891')
    expect(updatedTrip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(updatedTrip.stopTimings[0].departureTime).to.equal('22:50')
    expect(updatedTrip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(updatedTrip.stopTimings[1].departureTime).to.equal('23:13')
    expect(updatedTrip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(updatedTrip.stopTimings[8].departureTime).to.equal('23:55')
  })

  it('Uses the origin\'s offset when the offset on the first and last stop do not match and are within 5min', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let liveTimetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await gtfsTimetables.createDocument(clone(td8891GTFS))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8891_Late.replace('23:55', '23:59'), vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    // Go direct to altered times
    await loadOperationalTT(database, database, utils.parseDate('20250719'), ptvAPI)
    let updatedTrip = await liveTimetables.findDocument({})

    expect(updatedTrip.runID).to.equal('8891')
    expect(updatedTrip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(updatedTrip.stopTimings[0].departureTime).to.equal('22:50')
    expect(updatedTrip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(updatedTrip.stopTimings[1].departureTime).to.equal('23:13')
    expect(updatedTrip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(updatedTrip.stopTimings[8].departureTime).to.equal('23:55')
  })

  it('Matches a shorted trip not entered into the GTFS data', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')
    let gtfsTimetables = database.getCollection('gtfs timetables')

    await gtfsTimetables.createDocument(clone(td8741GTFS))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8741_Geelong, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20250718'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8741')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('11:30')
    expect(trip.stopTimings[0].cancelled).to.be.false

    expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('11:38')
    expect(trip.stopTimings[1].cancelled).to.be.false

    expect(trip.stopTimings[11].stopName).to.equal('South Geelong Railway Station')
    expect(trip.stopTimings[11].departureTime).to.equal('12:37')
    expect(trip.stopTimings[11].cancelled).to.be.true
  })

  it('Fetches a trip longer than is present in the GTFS data', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')
    let gtfsTimetables = database.getCollection('gtfs timetables')

    await gtfsTimetables.createDocument(clone(td8457GTFS))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8457, vlineTripsEmpty, td8457 ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20250905'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8457')
    expect(trip.origin).to.equal('Southern Cross Railway Station')
    expect(trip.departureTime).to.equal('22:59')
  })

  it('Handles the missing 2am on Sunday from Saturday TT trips when DST starts', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')
    let gtfsTimetables = database.getCollection('gtfs timetables')

    await gtfsTimetables.createDocument(clone(dstStartNo2amTripsGTFS))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ dstStartTripSat, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20251004'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8821')
    expect(trip.origin).to.equal('Southern Cross Railway Station')
    expect(trip.departureTime).to.equal('25:10')
    expect(trip.stopTimings[0].departureTime).to.equal('01:10')

    expect(trip.destination).to.equal('Waurn Ponds Railway Station')
    expect(trip.destinationArrivalTime).to.equal('26:29')
    expect(trip.stopTimings[trip.stopTimings.length - 1].arrivalTime).to.equal('03:29')
  })

  it('Handles the missing 2am on Sunday from Sunday TT trips when DST starts', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')
    let gtfsTimetables = database.getCollection('gtfs timetables')

    await gtfsTimetables.createDocument(clone(dstStartNo2amTripsGTFS))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ dstStartTripSun, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20251005'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8800')
    expect(trip.origin).to.equal('Waurn Ponds Railway Station')
    expect(trip.departureTime).to.equal('18:01')
    expect(trip.stopTimings[0].departureTime).to.equal('18:01')

    expect(trip.destination).to.equal('Southern Cross Railway Station')
    expect(trip.destinationArrivalTime).to.equal('19:20')
    expect(trip.stopTimings[trip.stopTimings.length - 1].arrivalTime).to.equal('19:20')
  })

  it('Ignores trips with a null origin or destination', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let timetables = database.getCollection('live timetables')
    let liveTimetables = database.getCollection('live timetables')

    await liveTimetables.createDocument(clone(td8469Live))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8469_WTL, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, utils.parseDate('20251005'), ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8469')
    expect(trip.origin).to.equal('Southern Cross Railway Station')
    expect(trip.departureTime).to.equal('18:23')

    expect(trip.destination).to.equal('Traralgon Railway Station')
    expect(trip.destinationArrivalTime).to.equal('20:50')

    trip.stopTimings.slice(1, 5).forEach(stop => expect(stop.cancelled, `Expected ${stop.stopName} to be cancelled`).to.be.true)
    trip.stopTimings.slice(5).forEach(stop => expect(stop.cancelled).to.be.false)
  })
})