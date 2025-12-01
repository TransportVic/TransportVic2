import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import AgencyGenerator from '../../../modules/journey-planner/gtfs-generator/generators/AgencyGenerator.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The AgencyGenerator', () => {
  it('Generates a single TransportVic agency', async () => {
    const db = new LokiDatabaseConnection()
    const generator = new AgencyGenerator(db)

    const output = await generator.generateFileContents()
    const lines = output.split('\n')
    expect(lines[0]).to.equal(`agency_id,agency_name,agency_url,agency_timezone`)
    expect(lines[1]).to.equal(`0,TransportVic,https://transportvic.me,Australia/Melbourne`)
  })
})