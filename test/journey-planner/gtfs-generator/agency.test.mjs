import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import AgencyGenerator from '../../../modules/journey-planner/gtfs-generator/generators/AgencyGenerator.mjs'
import StopGenerator from '../../../modules/journey-planner/gtfs-generator/generators/StopGenerator.mjs'
import caulfield from './sample-data/caulfield.mjs'
import { WritableStream } from 'memory-streams'
import CalendarGenerator from '../../../modules/journey-planner/gtfs-generator/generators/CalendarGenerator.mjs'
import path from 'path'
import url from 'url'
import albury from './sample-data/albury.mjs'
import ballarat from './sample-data/ballarat.mjs'
import RouteGenerator from '../../../modules/journey-planner/gtfs-generator/generators/RouteGenerator.mjs'
import alburyTrips from './sample-data/albury-trips.mjs'
import TripGenerator from '../../../modules/journey-planner/gtfs-generator/generators/TripGenerator.mjs'
import ballaratMidnightTrip from './sample-data/ballarat-midnight-trip.mjs'
import PathwayGenerator from '../../../modules/journey-planner/gtfs-generator/generators/PathwayGenerator.mjs'
import TransferGenerator from '../../../modules/journey-planner/gtfs-generator/generators/TransferGenerator.mjs'
import tripStops from './sample-data/trip-stops.mjs'
import alameinTrip from './sample-data/alamein-trip.mjs'
import utils from '../../../utils.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clone = o => JSON.parse(JSON.stringify(o))

describe('The AgencyGenerator', () => {
  it('Generates a single TransportVic agency', async () => {
    const db = new LokiDatabaseConnection()
    const generator = new AgencyGenerator(db)

    const stream = new WritableStream()
    await generator.generateFileContents(stream)

    const lines = stream.toString().split('\n')
    expect(lines[0]).to.equal(`agency_id,agency_name,agency_url,agency_timezone`)
    expect(lines[1]).to.equal(`0,TransportVic,https://transportvic.me,Australia/Melbourne`)
  })
})

describe('The StopGenerator', () => {
  it('Generates one row per stop bay', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const generator = new StopGenerator(db)

    const stream = new WritableStream()
    await generator.generateFileContents(stream)

    const lines = stream.toString().split('\n')
    const header = lines[0], body = lines.slice(1)
  
    expect(header).to.equal(`stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,platform_code`)

    const stationP1 = body.find(row => row.includes('14251'))
    expect(stationP1).to.exist
    expect(stationP1).to.equal(`"14251","Caulfield Railway Station","-37.87736201","145.04208396","0","vic:rail:CFD",""`)

    const tramStop = body.find(row => row.includes('18457'))
    expect(tramStop).to.exist
    expect(tramStop).to.equal(`"18457","Caulfield Railway Station/Derby Road","-37.87640435","145.04193878","0","",""`)

    const busStop = body.find(row => row.includes('22022'))
    expect(busStop).to.exist
    expect(busStop).to.equal(`"22022","Caulfield Railway Station/Sir John Monash Drive","-37.87734375","145.04315316","0","",""`)

    const coachStop = body.find(row => row.includes('52537'))
    expect(coachStop).to.exist
    expect(coachStop).to.equal(`"52537","Caulfield Railway Station/Sir John Monash Drive","-37.87694242","145.04232245","0","",""`)
  })

  it('Only generates a stop once, even if it appears in multiple modes of transport', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const generator = new StopGenerator(db)

    const stream = new WritableStream()
    await generator.generateFileContents(stream)

    const lines = stream.toString().split('\n')
    const header = lines[0], body = lines.slice(1)

    expect(header).to.equal(`stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,platform_code`)

    const stationParent = body.filter(row => row.startsWith('"vic:rail:CFD"'))
    expect(stationParent).to.exist
    expect(stationParent.length).to.equal(1)
    expect(stationParent[0]).to.equal(`"vic:rail:CFD","Caulfield Railway Station","-37.87745946","145.04252478","1","",""`)
  })
})


describe('The CalendarGenerator', () => {
  it('Combines calendar.txt data, adding the mode prefix to the front', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const generator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))

    const calendarStream = new WritableStream()
    const calendarDateStream = new WritableStream()
    await generator.generateFileContents(calendarStream, calendarDateStream)

    const calLines = calendarStream.toString().split('\n')
    const calHeader = calLines[0], calBody = calLines.slice(1)
  
    expect(calHeader).to.equal(`service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date`)

    const vlineT2 = calBody.find(row => row.includes('1_T2'))
    expect(vlineT2).to.exist
    expect(vlineT2).to.equal(`"1_T2","0","0","0","0","0","1","0","20251129","20251129"`)

    const metroT2 = calBody.find(row => row.includes('2_T2'))
    expect(metroT2).to.exist
    expect(metroT2).to.equal(`"2_T2","0","0","0","0","0","1","0","20251128","20251204"`)
  })

  it('Combines calendar_dates.txt data, adding the mode prefix to the front', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const generator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))

    const calendarStream = new WritableStream()
    const calendarDateStream = new WritableStream()
    await generator.generateFileContents(calendarStream, calendarDateStream)

    const calDateLines = calendarDateStream.toString().split('\n')
    const calDateHeader = calDateLines[0], calDateBody = calDateLines.slice(1)

    expect(calDateHeader).to.equal(`service_id,date,exception_type`)

    const vlineException = calDateBody.find(row => row.includes('1_T0_11'))
    expect(vlineException).to.exist
    expect(vlineException).to.equal(`"1_T0_11","20251225","2"`)

    const metroException = calDateBody.find(row => row.includes('2_UH'))
    expect(metroException).to.exist
    expect(metroException).to.equal(`"2_UH","20251215","2"`)
  })
})

describe('The RouteGenerator', () => {
  it('Generates route.txt data', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    await dbRoutes.createDocument(clone(albury))
    await dbRoutes.createDocument(clone(ballarat))

    const generator = new RouteGenerator(db)

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await generator.generateFileContents(routeStream, shapeStream)

    const routeLines = routeStream.toString().split('\n')
    const routeHeader = routeLines[0], routeBody = routeLines.slice(1)
  
    expect(routeHeader).to.equal(`route_id,route_short_name,route_type`)

    const alburyData = routeBody.find(row => row.includes('1-ABY'))
    expect(alburyData).to.exist
    expect(alburyData).to.equal(`"1-ABY","Albury","2"`)

    const ballaratData = routeBody.find(row => row.includes('1-BAT'))
    expect(ballaratData).to.exist
    expect(ballaratData).to.equal(`"1-BAT","Ballarat","2"`)
  })

  it('Generates shapes.txt data, only generating one shape per duplicate', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    await dbRoutes.createDocument(clone(albury))
    await dbRoutes.createDocument(clone(ballarat))

    const generator = new RouteGenerator(db)

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await generator.generateFileContents(routeStream, shapeStream)

    const shapeLines = shapeStream.toString().split('\n')
    const shapeHeader = shapeLines[0], shapeBody = shapeLines.slice(1)
  
    expect(shapeHeader).to.equal(`shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence`)

    const albury10Data = shapeBody.filter(row => row.includes('1-ABY-mjp-10.1.H'))
    expect(albury10Data.length).to.be.greaterThan(1)
    expect(albury10Data[0]).to.equal(`"1-ABY-mjp-10.1.H","-37.81816407","144.95215219","0"`)
    expect(albury10Data[1]).to.equal(`"1-ABY-mjp-10.1.H","-37.81807437","144.95208287","1"`)

    const albury11Data = shapeBody.find(row => row.includes('1-ABY-mjp-11.1.H'))
    expect(albury11Data).to.not.exist
  })

  it('Returns a mapping of duplicate shape IDs', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    await dbRoutes.createDocument(clone(albury))
    await dbRoutes.createDocument(clone(ballarat))

    const generator = new RouteGenerator(db)

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await generator.generateFileContents(routeStream, shapeStream)

    const shapeMapping = generator.getShapeMapping()
    expect(shapeMapping['1-ABY-mjp-10.1.H']).to.equal('1-ABY-mjp-10.1.H')
    expect(shapeMapping['1-ABY-mjp-11.1.H']).to.equal('1-ABY-mjp-10.1.H')
    expect(shapeMapping['1-ABY-mjp-16.1.H']).to.equal('1-ABY-mjp-10.1.H')
    expect(shapeMapping['1-ABY-mjp-9.1.H']).to.equal('1-ABY-mjp-10.1.H')

    expect(shapeMapping['1-ABY-mjp-10.2.R']).to.equal('1-ABY-mjp-10.2.R')
    expect(shapeMapping['1-ABY-mjp-11.2.R']).to.equal('1-ABY-mjp-10.2.R')
    expect(shapeMapping['1-ABY-mjp-16.2.R']).to.equal('1-ABY-mjp-10.2.R')
    expect(shapeMapping['1-ABY-mjp-9.2.R']).to.equal('1-ABY-mjp-10.2.R')
  })
})

describe('The TripGenerator', () => {
  const originalNow = utils.now
  beforeEach(() => {
    utils.now = () => utils.parseDate('20251205')
  })

  after(() => {
    utils.now = originalNow
  })

  it('Generates trip.txt data', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    const dbTrips = await db.getCollection('gtfs timetables')
    const dbStops = await db.getCollection('stops')
    await dbRoutes.createDocument(clone(albury))
    await dbTrips.createDocuments(clone(alburyTrips))
    await dbStops.createDocuments(clone(tripStops))

    const calGenerator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))
    calGenerator.generateFileContents(new WritableStream(), new WritableStream())

    const routeGenerator = new RouteGenerator(db)

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await routeGenerator.generateFileContents(routeStream, shapeStream)

    const shapeMapping = routeGenerator.getShapeMapping()

    const tripGenerator = new TripGenerator(db, shapeMapping)

    const tripStream = new WritableStream()
    const stopTimesStream = new WritableStream()
    await tripGenerator.generateFileContents(tripStream, stopTimesStream, calGenerator)

    const tripLines = tripStream.toString().split('\n')
    const tripHeader = tripLines[0], tripBody = tripLines.slice(1)
  
    expect(tripHeader).to.equal(`route_id,service_id,trip_id,block_id,shape_id`)

    const albury10Trip = tripBody.find(row => row.includes('01-ABY--10-T3-8605'))
    expect(albury10Trip).to.exist
    expect(albury10Trip).to.equal(`"1-ABY","1_T3_1","01-ABY--10-T3-8605","","1-ABY-mjp-10.1.H"`)

    const albury6Trip = tripBody.find(row => row.includes('01-ABY--6-T0-8605'))
    expect(albury6Trip).to.exist
    expect(albury6Trip).to.equal(`"1-ABY","1_T0_2","01-ABY--6-T0-8605","","1-ABY-mjp-10.1.H"`)
  })

  it('Generates stop_times.txt data', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    const dbTrips = await db.getCollection('gtfs timetables')
    const dbStops = await db.getCollection('stops')
    await dbRoutes.createDocument(clone(albury))
    await dbTrips.createDocuments(clone(alburyTrips))
    await dbStops.createDocuments(clone(tripStops))

    const routeGenerator = new RouteGenerator(db)

    const calGenerator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))
    calGenerator.generateFileContents(new WritableStream(), new WritableStream())

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await routeGenerator.generateFileContents(routeStream, shapeStream)

    const shapeMapping = routeGenerator.getShapeMapping()

    const tripGenerator = new TripGenerator(db, shapeMapping)

    const tripStream = new WritableStream()
    const stopTimesStream = new WritableStream()
    await tripGenerator.generateFileContents(tripStream, stopTimesStream, calGenerator)

    const stopLines = stopTimesStream.toString().split('\n')
    const stopHeader = stopLines[0], stopBody = stopLines.slice(1)
  
    expect(stopHeader).to.equal(`trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type`)

    const albury10Trip = stopBody.filter(row => row.includes('01-ABY--10-T3-8605'))
    expect(albury10Trip.length).to.be.greaterThan(1)
    expect(albury10Trip[0]).to.equal(`"01-ABY--10-T3-8605","07:07:00","07:07:00","20043","0","0","1"`)
    expect(albury10Trip[1]).to.equal(`"01-ABY--10-T3-8605","07:35:00","07:35:00","22254","1","0","1"`)
    expect(albury10Trip[2]).to.equal(`"01-ABY--10-T3-8605","08:24:00","08:26:00","20342","2","0","0"`)

    const albury6Trip = stopBody.filter(row => row.includes('01-ABY--6-T0-8605'))
    expect(albury6Trip.length).to.be.greaterThan(1)
    expect(albury6Trip[0]).to.equal(`"01-ABY--6-T0-8605","07:07:00","07:07:00","20043","0","0","1"`)
  })

  it('Uses PT times past 23:59 for trips running past midnight', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    const dbTrips = await db.getCollection('gtfs timetables')
    const dbStops = await db.getCollection('stops')
    await dbRoutes.createDocument(clone(ballarat))
    await dbTrips.createDocument(clone(ballaratMidnightTrip))
    await dbStops.createDocuments(clone(tripStops))

    const routeGenerator = new RouteGenerator(db)

    const calGenerator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))
    calGenerator.generateFileContents(new WritableStream(), new WritableStream())

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await routeGenerator.generateFileContents(routeStream, shapeStream)

    const shapeMapping = routeGenerator.getShapeMapping()

    const tripGenerator = new TripGenerator(db, shapeMapping)

    const tripStream = new WritableStream()
    const stopTimesStream = new WritableStream()
    await tripGenerator.generateFileContents(tripStream, stopTimesStream, calGenerator)

    const stopLines = stopTimesStream.toString().split('\n')
    const stopBody = stopLines.slice(1)
  
    expect(stopBody.length).to.be.greaterThan(1)
    expect(stopBody[0]).to.equal(`"01-BAT--10-T3-8161","23:16:00","23:16:00","20043","0","0","1"`) // SSS
    expect(stopBody[1]).to.equal(`"01-BAT--10-T3-8161","23:24:00","23:24:00","22240","1","0","1"`) // FSY
    expect(stopBody[2]).to.equal(`"01-BAT--10-T3-8161","23:29:00","23:29:00","22241","2","0","1"`) // SUN
    expect(stopBody[8]).to.equal(`"01-BAT--10-T3-8161","23:54:00","23:54:00","19980","8","0","0"`) // MEL
    expect(stopBody[9]).to.equal(`"01-BAT--10-T3-8161","24:02:00","24:02:00","20290","9","0","0"`) // BAH
    expect(stopBody[10]).to.equal(`"01-BAT--10-T3-8161","24:20:00","24:20:00","20292","10","0","0"`) // BLN
  })

  it('Picks the platform stop where available', async () => {
    const db = new LokiDatabaseConnection()
    const dbTrips = await db.getCollection('gtfs timetables')
    const dbStops = await db.getCollection('stops')
    await dbTrips.createDocument({
      ...clone(alameinTrip),
      operationDays: [ '20251210' ]
    })
    await dbStops.createDocuments(clone(tripStops))

    const shapeMapping = { '2-ALM-vpt-1.1.R': '2-ALM-vpt-1.1.R' }

    const tripGenerator = new TripGenerator(db, shapeMapping)

    const calGenerator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))
    calGenerator.generateFileContents(new WritableStream(), new WritableStream())

    const tripStream = new WritableStream()
    const stopTimesStream = new WritableStream()
    await tripGenerator.generateFileContents(tripStream, stopTimesStream, calGenerator)

    const stopLines = stopTimesStream.toString().split('\n')
    const stopBody = stopLines.slice(1)
  
    expect(stopBody.length).to.be.greaterThan(1)
    expect(stopBody[0]).to.equal(`"02-ALM--1-T2-2302","04:57:00","04:57:00","11197","0","0","1"`) // ALM 1
    expect(stopBody[1]).to.equal(`"02-ALM--1-T2-2302","04:58:00","04:58:00","11198","1","0","0"`) // ASH 1
    expect(stopBody[6]).to.equal(`"02-ALM--1-T2-2302","05:08:00","05:08:00","11208","6","1","0"`) // CAM 2
  })

  it('Only picks 3 weeks of data', async () => {
    const db = new LokiDatabaseConnection()
    const dbTrips = await db.getCollection('gtfs timetables')
    const dbStops = await db.getCollection('stops')

    await dbTrips.createDocument(clone(alameinTrip))
    await dbStops.createDocuments(clone(tripStops))

    const shapeMapping = { '2-ALM-vpt-1.1.R': '2-ALM-vpt-1.1.R' }

    const tripGenerator = new TripGenerator(db, shapeMapping)

    const calGenerator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))
    calGenerator.generateFileContents(new WritableStream(), new WritableStream())

    const tripStream = new WritableStream()
    const stopTimesStream = new WritableStream()
    await tripGenerator.generateFileContents(tripStream, stopTimesStream, calGenerator)

    const stopLines = stopTimesStream.toString().trim().split('\n')
    const stopBody = stopLines.slice(1)
    expect(stopBody.length).to.equal(0)
  })
})

describe('The PathwayGenerator', () => {
  it('Copies pathway data from the GTFS folder', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const generator = new PathwayGenerator(db, path.join(__dirname, 'sample-data', 'misc'))

    const pathwayStream = new WritableStream()
    await generator.generateFileContents(pathwayStream)

    const pathLines = pathwayStream.toString().split('\n')
    const pathHeader = pathLines[0], pathBody = pathLines.slice(1)

    expect(pathHeader).to.equal(`pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional,traversal_time`)

    expect(pathBody[0]).to.equal(`"vic:rail:CFD_BR1_vic:rail:CFD_EN4_walkway_1","vic:rail:CFD_BR1","vic:rail:CFD_EN4","1","1","72"`)
    expect(pathBody[1]).to.equal(`"vic:rail:CFD_BR1_vic:rail:CFD_EN6_walkway_1","vic:rail:CFD_BR1","vic:rail:CFD_EN6","1","1","36"`)
  })

  it('Removes duplicate lines from the various modes', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const generator = new PathwayGenerator(db, path.join(__dirname, 'sample-data', 'misc'))

    const pathwayStream = new WritableStream()
    await generator.generateFileContents(pathwayStream)

    const pathLines = pathwayStream.toString().split('\n')
    const pathHeader = pathLines[0], pathBody = pathLines.slice(1)

    expect(pathHeader).to.equal(`pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional,traversal_time`)

    const walkway = pathBody.filter(line => line.includes('vic:rail:CFD_BR1_vic:rail:CFD_EN4_walkway_1'))
    expect(walkway.length).to.equal(1)
  })
})

describe('The TransferGenerator', () => {
  it('Copies transfer data from the GTFS folder, shortening the route IDs', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const tripsSeen = new Set([
      '02-MDD--28-T6-1180',
      '02-HBE--28-T6-1311',
      '02-HBE--28-T2-7182',
      '02-MDD--28-T2-7701',
      '14.T0.6-a20-mjp-1.5.H',
      '30.T0.6-a20-mjp-1.8.R'
    ])

    const generator = new TransferGenerator(db, tripsSeen, path.join(__dirname, 'sample-data', 'misc'))

    const transferStream = new WritableStream()
    await generator.generateFileContents(transferStream)

    const transferLines = transferStream.toString().split('\n')
    const transferHeader = transferLines[0], transferBody = transferLines.slice(1)

    expect(transferHeader).to.equal(`from_stop_id,to_stop_id,from_route_id,to_route_id,from_trip_id,to_trip_id,transfer_type,min_transfer_time`)

    expect(transferBody[0]).to.equal(`"11212","11212","2-MDD","2-HBE","02-MDD--28-T6-1180","02-HBE--28-T6-1311","4",""`)
    expect(transferBody[1]).to.equal(`"11212","11212","2-HBE","2-MDD","02-HBE--28-T2-7182","02-MDD--28-T2-7701","4",""`)

    const bus = transferBody.find(line => line.includes('6-a20'))
    expect(bus).to.equal(`"37552","37552","6-a20","6-a20","14.T0.6-a20-mjp-1.5.H","30.T0.6-a20-mjp-1.8.R","4",""`)
  })

  it('Discards trips that were not seen before', async () => {
    const db = new LokiDatabaseConnection()
    const dbStops = await db.getCollection('stops')
    await dbStops.createDocument(clone(caulfield))

    const tripsSeen = new Set([
      '02-MDD--28-T6-1180',
      '02-HBE--28-T6-1311',
      '02-HBE--28-T2-7182',
      '02-MDD--28-T2-7701',
      '14.T0.6-a20-mjp-1.5.H',
      '30.T0.6-a20-mjp-1.8.R'
    ])

    const generator = new TransferGenerator(db, tripsSeen, path.join(__dirname, 'sample-data', 'misc'))

    const transferStream = new WritableStream()
    await generator.generateFileContents(transferStream)

    const transferLines = transferStream.toString().split('\n')
    const transferHeader = transferLines[0], transferBody = transferLines.slice(1)

    expect(transferHeader).to.equal(`from_stop_id,to_stop_id,from_route_id,to_route_id,from_trip_id,to_trip_id,transfer_type,min_transfer_time`)

    const trip = transferBody.find(line => line.includes('02-HBE--28-T3-1250'))
    expect(trip).to.not.exist
  })
})

describe('The TripGenerator and CalendarGenerator', () => {
  const originalNow = utils.now
  beforeEach(() => {
    utils.now = () => utils.parseDate('20251205')
  })

  after(() => {
    utils.now = originalNow
  })

  it('Allocates calendar IDs for trips without calendar IDs', async () => {
    const db = new LokiDatabaseConnection()
    const dbRoutes = await db.getCollection('routes')
    const dbTrips = await db.getCollection('gtfs timetables')
    const dbStops = await db.getCollection('stops')
    const trips = clone(alburyTrips)
    delete trips[0].calendarID
    delete trips[1].calendarID

    await dbRoutes.createDocument(clone(albury))
    await dbTrips.createDocuments(trips)
    await dbStops.createDocuments(clone(tripStops))

    const calGenerator = new CalendarGenerator(db, path.join(__dirname, 'sample-data', 'calendars'))
    const routeGenerator = new RouteGenerator(db)

    const calStream = new WritableStream()
    const calDateStream = new WritableStream()
    await calGenerator.generateFileContents(calStream, calDateStream)

    const routeStream = new WritableStream()
    const shapeStream = new WritableStream()
    await routeGenerator.generateFileContents(routeStream, shapeStream)

    const shapeMapping = routeGenerator.getShapeMapping()

    const tripGenerator = new TripGenerator(db, shapeMapping)

    const tripStream = new WritableStream()
    const stopTimesStream = new WritableStream()
    await tripGenerator.generateFileContents(tripStream, stopTimesStream, calGenerator)

    const calDates = calDateStream.toString().split('\n')

    const tripLines = tripStream.toString().split('\n')
    const tripBody = tripLines.slice(1)
  
    const albury10Trip = tripBody.find(row => row.includes('01-ABY--10-T3-8605'))
    expect(albury10Trip).to.exist

    const albury10Parts = albury10Trip.match(/"1-ABY","(\w+)".+/)
    expect(albury10Parts).to.exist

    const calID10 = albury10Parts[1]
    const lines10 = calDates.filter(line => line.includes(calID10))

    expect(lines10.length).to.be.equal(1)
    expect(lines10[0]).to.equal(`"${calID10}","${trips[0].operationDays[0]}","1"`)
  
    const albury6Trip = tripBody.find(row => row.includes('01-ABY--6-T0-8605'))
    expect(albury6Trip).to.exist

    const albury6Parts = albury6Trip.match(/"1-ABY","(\w+)".+/)
    expect(albury6Parts).to.exist

    const calID6 = albury6Parts[1]
    const lines6 = calDates.filter(line => line.includes(calID6))
    expect(lines6.length).to.be.equal(2)
    expect(lines6[0]).to.equal(`"${calID6}","${trips[1].operationDays[0]}","1"`)
    expect(lines6[1]).to.equal(`"${calID6}","${trips[1].operationDays[1]}","1"`)
  })
})