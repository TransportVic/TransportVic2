import { expect } from 'chai'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { StubVLineAPI, PTVAPI } from '@transportme/ptv-api'
import { GetPlatformServicesAPI, VLinePlatformService, VLinePlatformServices } from '@transportme/ptv-api/lib/vline/get-platform-services.mjs'
import { matchTrip } from '../load-vline-op-tt.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import td8741GTFS from './sample-data/td8741-gtfs.json' with { type: 'json' }
import allStops from './sample-data/stops.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const vlineTrips = (await fs.readFile(path.join(__dirname, 'sample-data', 'vline-trips.xml'))).toString()
const td8007 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8741-pattern.xml'))).toString()
const td8741 = (await fs.readFile(path.join(__dirname, 'sample-data', 'td8007-pattern.xml'))).toString()

describe('The matchTrip function', () => {
  it.only('Matches a V/Line API trip to a GTFS trip', async () => {
    let database = new LokiDatabaseConnection()
    let gtfsTimetables = database.getCollection('gtfs timetables')
    let stops = database.getCollection('stops')

    await gtfsTimetables.createDocument(td8741GTFS)
    await stops.createDocument(allStops)

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

      let matchingTrip = matchTrip('20250718', departures[0], database)
      expect(matchingTrip).to.exist
      expect(matchingTrip.tripID).to.equal('48.T0.1-GEL-mjp-8.11.H')
  })
})