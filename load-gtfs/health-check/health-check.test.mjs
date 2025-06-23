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
      const testDB1 = new LokiDatabaseConnection()
      testDB1.connect()
      const stops1 = await testDB1.createCollection('stops')
      await stops1.createDocuments(clone(expectedStops.filter(stop => !stop.stopName.startsWith('Flinders Street'))))

      expect(await checkStops(testDB1)).to.deep.equal({
        status: 'fail',
        failures: [{
          stop: 'Flinders Street',
          reason: 'missing'
        }]
      })

      const testDB2 = new LokiDatabaseConnection()
      testDB2.connect()
      const stops2 = await testDB2.createCollection('stops')
      await stops2.createDocuments(clone(expectedStops.filter(stop => !stop.stopName.startsWith('Bendigo'))))

      expect(await checkStops(testDB2)).to.deep.equal({
        status: 'fail',
        failures: [{
          stop: 'Bendigo',
          reason: 'missing'
        }]
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

      expect(await checkStops(testDB)).to.deep.equal({
        status: 'fail',
        failures: [{
          stop: 'Flinders Street',
          reason: 'missing-bay'
        }]
      })
    })
  })
})