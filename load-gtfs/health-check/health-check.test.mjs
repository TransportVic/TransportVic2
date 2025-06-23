import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleSchTrips from '../../modules/departures/test/sample-data/sample-sch-trips.json' with { type: 'json' }
import expectedStops from './sample-data/expected-stops.json' with { type: 'json' }
import { checkStop, checkStops } from './check.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

const validDB = new LokiDatabaseConnection()
validDB.connect()
await (await validDB.createCollection('gtfs timetables')).createDocuments(clone(sampleSchTrips))
await (await validDB.createCollection('stops')).createDocuments(clone(expectedStops))

describe('The GTFS health check module', () => {
  describe ('The checkStop function', () => {
    it('Should fail if a stop is missing', async () => {
      const testDB1 = new LokiDatabaseConnection()
      testDB1.connect()
      const stops1 = await testDB1.createCollection('stops')
      await stops1.createDocuments(clone(expectedStops.filter(stop => !stop.stopName.startsWith('Flinders Street'))))

      expect(await checkStop(stops1, 'Flinders Street Railway Station', 'metro train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing'
      })

      const testDB2 = new LokiDatabaseConnection()
      testDB2.connect()
      const stops2 = await testDB2.createCollection('stops')
      await stops2.createDocuments(clone(expectedStops.filter(stop => !stop.stopName.startsWith('Bendigo'))))

      expect(await checkStop(stops2, 'Bendigo Railway Station', 'regional train')).to.deep.equal({
        stop: 'Bendigo Railway Station',
        reason: 'missing'
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

      expect(await checkStop(stops, 'Flinders Street Railway Station', 'metro train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-bay'
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

      expect(await checkStop(stops, 'Flinders Street Railway Station', 'metro train')).to.deep.equal({
        stop: 'Flinders Street Railway Station',
        reason: 'missing-bay-services'
      })
    })
  })
})