import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleSchTrips from '../../modules/departures/test/sample-data/sample-sch-trips.json' with { type: 'json' }
import expectedStops from './sample-data/expected-metro-stops.json' with { type: 'json' }
import { checkStops } from './check.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

const validDB = new LokiDatabaseConnection()
validDB.connect()
await (await validDB.createCollection('gtfs timetables')).createDocuments(clone(sampleSchTrips))
await (await validDB.createCollection('stops')).createDocuments(clone(expectedStops))

describe('The GTFS health check module', () => {
  describe('The checkStops function', () => {
    it('Should verify that certain key stops are present', async () => {
      expect(await checkStops(validDB)).to.deep.equal({
        status: 'ok'
      })
    })

    it('Should fail if a stop is missing', async () => {
      const db = new LokiDatabaseConnection()
      db.connect()
      const stops = await db.createCollection('stops')

      let outcome = await checkStops(db)
      expect(outcome.status).to.equal('fail')
      expect(outcome.failures.some(failure => failure.stop === 'Flinders Street' && failure.reason === 'missing')).to.be.true
    })
  })
})