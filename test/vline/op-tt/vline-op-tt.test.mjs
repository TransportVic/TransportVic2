import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { GetPlatformServicesAPI, VLinePlatformService } from '@transportme/ptv-api/lib/vline/get-platform-services.mjs'
import loadOperationalTT, { downloadTripPattern, matchTrip } from '../../../modules/op-timetable/load-vline-op-tt.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import td8741GTFS from './sample-data/td8741-gtfs.json' with { type: 'json' }
import td8776GTFS from './sample-data/alterations/td8776-gtfs.mjs'
import td8891Live from './sample-data/time-change/td8891-live.json' with { type: 'json' }
import td8891GTFS from './sample-data/time-change/td8891-gtfs.json' with { type: 'json' }
import td8007NSP from './sample-data/td8007-nsp.json' with { type: 'json' }
import allStops from './sample-data/stops.json' with { type: 'json' }
import allRoutes from './sample-data/routes.json' with { type: 'json' }
import VLineUtils from '../../../modules/vline/vline-utils.mjs'
import utils from '../../../utils.mjs'
import td8457GTFS from './sample-data/td8457-gtfs.mjs'
import dstStartNo2amTripsGTFS from './sample-data/dst-start-no2am-trips.mjs'
import td8469Live from './sample-data/null-destination/td8469-live.mjs'
import heatServices from './sample-data/heat-timetable/services.mjs'
import td8469NSP from './sample-data/null-destination/td8469-nsp.mjs'
import td8895 from './sample-data/midnight-trips/td8895.mjs'
import td8181Live from './sample-data/preloaded-amex/td8181-live.mjs'
import VLineTripUpdater from '../../../modules/vline/trip-updater.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const vlineTripsTD8457 = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips-td8457.xml'))).toString()
const td8457 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8457-pattern.xml'))).toString()

const vlineTripsTD8741_Normal = (await fs.readFile(path.join(__dirname, 'sample-data', 'alterations', 'td8741-normal.xml'))).toString()
const vlineTripsTD8741_Geelong = (await fs.readFile(path.join(__dirname, 'sample-data', 'alterations', 'td8741-terminate-geelong.xml'))).toString()

const vlineTripsTD8776_Normal = (await fs.readFile(path.join(__dirname, 'sample-data', 'alterations', 'td8776-normal.xml'))).toString()
const vlineTripsTD8776_Marshall = (await fs.readFile(path.join(__dirname, 'sample-data', 'alterations', 'td8776-terminate-marshall.xml'))).toString()

const vlineTripsTD8891_Normal = (await fs.readFile(path.join(__dirname, 'sample-data', 'time-change', 'td8891-2235.xml'))).toString()
const vlineTripsTD8891_Late = (await fs.readFile(path.join(__dirname, 'sample-data', 'time-change', 'td8891-2250.xml'))).toString()

const vlineTripsTD8895 = (await fs.readFile(path.join(__dirname, 'sample-data', 'midnight-trips', 'td8895.xml'))).toString()

const vlineTripsEmpty = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips-empty.xml'))).toString()

const vlineTrips = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips.xml'))).toString()
const td8007Early = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-early-pattern.xml'))).toString()
const td8007Late = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-late-pattern.xml'))).toString()
const td8741 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8741-pattern.xml'))).toString()

const dstStartTripSat = (await fs.readFile(path.join(__dirname, 'sample-data', 'dst-start-no2am-sat.xml'))).toString()
const dstStartTripSun = (await fs.readFile(path.join(__dirname, 'sample-data', 'dst-start-no2am-sun.xml'))).toString()

const vlineTripsTD8469_WTL = (await fs.readFile(path.join(__dirname, 'sample-data', 'null-destination', 'vline-trips-td8469-wtl.xml'))).toString()

const vlineTripsTD8181 = (await fs.readFile(path.join(__dirname, 'sample-data', 'preloaded-amex', 'vline-trips-td8181.xml'))).toString()

const heatDay = utils.parseDate('20251205')
const heatTimetableTemplate = (await fs.readFile(path.join(__dirname, 'sample-data', 'heat-timetable', 'template.xml'))).toString()
const heatResponseBody = heatServices.map(service => 
  heatTimetableTemplate
    .replace('{0}', heatDay.clone().add(service.stopTimings[0].departureTimeMinutes, 'minutes').format('YYYYMMDDTHH:mm:ss'))
    .replace('{1}', heatDay.clone().add(service.stopTimings[service.stopTimings.length - 1].departureTimeMinutes, 'minutes').format('YYYYMMDDTHH:mm:ss'))
    .replace('{2}', service.runID)
)
const heatResponse = `<GetPlatformDeparturesResponse xmlns="http://tempuri.org/">
<GetPlatformDeparturesResult xmlns:a="http://schemas.datacontract.org/2004/07/VLine.JourneyPlanner.Entities" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
${heatResponseBody.join('')}
</GetPlatformDeparturesResult>
</GetPlatformDeparturesResponse>`

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

    let matchingTrip = await matchTrip('20250718', utils.parseDate('20250718'), departures[0], database, database.getCollection('gtfs timetables'))
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

    let matchingTrip = await matchTrip('20250718', utils.parseDate('20250718'), departures[0], database, database.getCollection('gtfs timetables'))
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

    let matchingTrip = await matchTrip('20250726', utils.parseDate('20250726'), departures[1], database, database.getCollection('gtfs timetables'))
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

    let matchingTrip = await matchTrip('20250726', utils.parseDate('20250726'), departures[2], database, database.getCollection('gtfs timetables'))
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

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8741')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('11:30')
    expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('11:38')

    expect(trip.vehicle).to.deep.equal({
      consist: [],
      size: 3,
      type: 'VLocity',
      forced: true
    })
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
    await loadOperationalTT(database, database, ptvAPI)
    await loadOperationalTT(database, database, ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8741')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('11:30')
    expect(trip.stopTimings[1].stopName).to.equal('Footscray Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('11:38')
  })

  it('Shorts a trip when altered to terminate early', async () => {
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

    await loadOperationalTT(database, database, ptvAPI)
    await loadOperationalTT(database, database, ptvAPI)
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

  it('Shorts a trip when altered to originate late', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let liveTimetables = database.getCollection('live timetables')

    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))
    await gtfsTimetables.createDocument(clone(td8776GTFS))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8776_Normal, vlineTripsEmpty, vlineTripsTD8776_Marshall, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({})

    expect(trip.runID).to.equal('8776')
    expect(trip.stopTimings[0].stopName).to.equal('Waurn Ponds Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('14:21')
    expect(trip.stopTimings[0].cancelled).to.be.true

    expect(trip.stopTimings[1].stopName).to.equal('Marshall Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('14:25')
    expect(trip.stopTimings[1].cancelled).to.be.false

    expect(trip.stopTimings[3].stopName).to.equal('Geelong Railway Station')
    expect(trip.stopTimings[3].departureTime).to.equal('14:35')
    expect(trip.stopTimings[3].cancelled).to.be.false
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

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8891')
    expect(trip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stopTimings[0].departureTime).to.equal('22:35')
    expect(trip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(trip.stopTimings[1].departureTime).to.equal('22:58')
    expect(trip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(trip.stopTimings[8].departureTime).to.equal('23:40')

    await loadOperationalTT(database, database, ptvAPI)
    let updatedTrip = await timetables.findDocument({})

    expect(updatedTrip.runID).to.equal('8891')
    expect(updatedTrip.stopTimings[0].stopName).to.equal('Southern Cross Railway Station')
    expect(updatedTrip.stopTimings[0].departureTime).to.equal('22:50')
    expect(updatedTrip.stopTimings[1].stopName).to.equal('Tarneit Railway Station')
    expect(updatedTrip.stopTimings[1].departureTime).to.equal('23:13')
    expect(updatedTrip.stopTimings[8].stopName).to.equal('South Geelong Railway Station')
    expect(updatedTrip.stopTimings[8].departureTime).to.equal('23:55')

    // Further updates should not change the time any more
    await loadOperationalTT(database, database, ptvAPI)
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
    await loadOperationalTT(database, database, ptvAPI)
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
    await loadOperationalTT(database, database, ptvAPI)
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

    await loadOperationalTT(database, database, ptvAPI)
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

    await loadOperationalTT(database, database, ptvAPI)
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

    await loadOperationalTT(database, database, ptvAPI)
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

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await timetables.findDocument({})

    expect(trip.runID).to.equal('8800')
    expect(trip.origin).to.equal('Waurn Ponds Railway Station')
    expect(trip.departureTime).to.equal('18:01')
    expect(trip.stopTimings[0].departureTime).to.equal('18:01')

    expect(trip.destination).to.equal('Southern Cross Railway Station')
    expect(trip.destinationArrivalTime).to.equal('19:20')
    expect(trip.stopTimings[trip.stopTimings.length - 1].arrivalTime).to.equal('19:20')
  })

  it('Attempts to match a trip with a null origin using the NSP + the given time', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let liveTimetables = database.getCollection('live timetables')
    let timetables = database.getCollection('timetables')

    await timetables.createDocument(clone(td8469NSP))
    await liveTimetables.createDocument(clone(td8469Live))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8469_WTL, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({})

    expect(trip.runID).to.equal('8469')
    expect(trip.origin).to.equal('Southern Cross Railway Station')
    expect(trip.departureTime).to.equal('18:23')

    expect(trip.destination).to.equal('Traralgon Railway Station')
    expect(trip.destinationArrivalTime).to.equal('20:50')

    expect(trip.stopTimings[5].stopName).to.equal('Westall Railway Station')
    expect(trip.stopTimings[5].stopGTFSID).to.equal('vic:rail:WTL')
    expect(trip.stopTimings[5].platform).to.equal('3?')

    trip.stopTimings.slice(0, 5).forEach(stop => expect(stop.cancelled, `Expected ${stop.stopName} to be cancelled`).to.be.true)
    trip.stopTimings.slice(5).forEach(stop => expect(stop.cancelled).to.be.false)
  })

  it('Attempts to load from an extreme heat timetable when many trips do not match', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let heatTimetables = database.getCollection('heat timetables')
    let liveTimetables = database.getCollection('live timetables')

    await heatTimetables.createDocuments(clone(heatServices))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ heatResponse, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({ runID: '8430' })

    expect(trip).to.exist
    expect(trip.departureTime).to.equal('12:26')
    expect(trip.destinationArrivalTime).to.equal('15:07')

    expect(trip.flags).to.deep.equal({ heatTT: '36 degrees' })
  })

  it('Matches an already-created trip from the previous day between 12-3am', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let liveTimetables = database.getCollection('live timetables')

    await liveTimetables.createDocument(clone(td8895))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8895, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({ runID: '8895' })

    expect(trip).to.exist
    expect(trip.departureTime).to.equal('25:50')
  })

  it('Matches an already-created trip from the previous day between 12-3am even after 3am', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let liveTimetables = database.getCollection('live timetables')

    await liveTimetables.createDocument(clone(td8895))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8895, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({ runID: '8895' })

    expect(trip).to.exist
    expect(trip.departureTime).to.equal('25:50')
  })

  it('Amends a trip that was fully cancelled previously and now runs a shortened trip', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let liveTimetables = database.getCollection('live timetables')

    await liveTimetables.createDocument(clone(td8181Live))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8181, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({ runID: '8181' })

    expect(trip).to.exist
    expect(trip.cancelled).to.be.false
    expect(trip.stopTimings[0].cancelled, 'Expected SSS to not be cancelled').to.be.false
    expect(trip.stopTimings[10].cancelled, 'Expected BLN to not be cancelled').to.be.false
    expect(trip.stopTimings[11].cancelled, 'Expected BAT to not be cancelled').to.be.false

    expect(trip.stopTimings[12].cancelled, 'Expected WED to be cancelled').to.be.true
  })

  it('Updates an existing trip\'s vehicle', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let liveTimetables = database.getCollection('live timetables')

    await gtfsTimetables.createDocument(clone(td8741GTFS))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    const secondResponse = vlineTripsTD8741_Normal.replaceAll('VLocity', 'Sprinter')

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8741_Normal, vlineTripsEmpty, secondResponse, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({ runID: '8741' })

    expect(trip.vehicle).to.deep.equal({
      consist: [],
      size: 3,
      type: 'VLocity'
    })

    await loadOperationalTT(database, database, ptvAPI)
    let updatedTrip = await liveTimetables.findDocument({ runID: '8741' })

    expect(updatedTrip.vehicle).to.deep.equal({
      consist: [],
      size: 1,
      type: 'Sprinter',
      forced: true
    })
    expect(updatedTrip.changes.length).to.equal(1)
    expect(updatedTrip.changes[0].type).to.equal('veh-change')
    expect(updatedTrip.changes[0].oldVal.type).to.equal('VLocity')
    expect(updatedTrip.changes[0].oldVal.size).to.equal(3)
    expect(updatedTrip.changes[0].newVal.type).to.equal('Sprinter')
    expect(updatedTrip.changes[0].newVal.size).to.equal(1)
  })

  it('Does not delete an existing consist', async () => {
    let database = new LokiDatabaseConnection()
    let stops = database.getCollection('stops')
    let routes = database.getCollection('routes')
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let liveTimetables = database.getCollection('live timetables')

    await gtfsTimetables.createDocument(clone(td8741GTFS))
    await stops.createDocuments(clone(allStops))
    await routes.createDocuments(clone(allRoutes))

    let stubAPI = new StubVLineAPI()
    stubAPI.setResponses([ vlineTripsTD8741_Normal, vlineTripsEmpty, vlineTripsTD8741_Normal, vlineTripsEmpty ])
    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addVLine(stubAPI)

    await loadOperationalTT(database, database, ptvAPI)
    let trip = await liveTimetables.findDocument({ runID: '8741' })

    expect(trip.vehicle).to.deep.equal({
      consist: [],
      size: 3,
      type: 'VLocity'
    })

    await VLineTripUpdater.updateTrip(database, database, {
      operationDays: trip.operationDays,
      runID: '8741',
      consist: [ 'VL00' ]
    })

    await loadOperationalTT(database, database, ptvAPI)
    let updatedTrip = await liveTimetables.findDocument({ runID: '8741' })

    expect(updatedTrip.vehicle).to.deep.equal({
      consist: [ 'VL00' ],
      size: 3,
      type: 'VLocity'
    })
  })
})