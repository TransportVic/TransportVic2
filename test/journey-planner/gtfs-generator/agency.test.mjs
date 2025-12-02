import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import AgencyGenerator from '../../../modules/journey-planner/gtfs-generator/generators/AgencyGenerator.mjs'
import StopGenerator from '../../../modules/journey-planner/gtfs-generator/generators/StopGenerator.mjs'
import caulfield from './sample-data/caulfield.mjs'
import { WritableStream } from 'memory-streams'

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
    console.log(lines)
    const stationParent = body.filter(row => row.startsWith('"vic:rail:CFD"'))
    expect(stationParent).to.exist
    expect(stationParent.length).to.equal(1)
    expect(stationParent[0]).to.equal(`"vic:rail:CFD","Caulfield Railway Station","-37.87745946","145.04252478","1","",""`)
  })
})