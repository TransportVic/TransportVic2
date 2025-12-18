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