import { expect } from 'chai'
import { getUpcomingTrips } from '../metro-gtfsr-trips.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import pkmStops from './sample-data/pkm-stops-db.json' with { type: 'json' }
import gtfsr_EPH from './sample-data/gtfsr-eph.json' with { type: 'json' }
import { updateTrip } from '../trip-updater.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The trip updater module', () => {
  it('Should take the standardised trip data and update the database as needed', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    await stops.createDocuments(clone(pkmStops))
    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Pakenham",
      "cleanName" : "pakenham",
      "routeNumber" : null,
      "routeGTFSID" : "2-PKM",
      "operators" : [
        "Metro"
      ],
      "codedName" : "pakenham"
    })

    let gtfsrTrips = await getUpcomingTrips(database, () => gtfsr_EPH)
    let tripData = await updateTrip(database, gtfsrTrips[0])

    expect(tripData.mode).to.equal('metro train')
    expect(tripData.routeGTFSID).to.equal('2-PKM')
    expect(tripData.routeName).to.equal('Pakenham')
    expect(tripData.operationDay).to.equal('20250606')
    expect(tripData.operationDayMoment.toISOString()).to.equal('2025-06-06T14:00:00.000Z')
    expect(tripData.block).to.be.null
    // expect(tripData.tripID).to.equal('02-MDD--23-T5-1000')
    // expect(tripData.shapeID).to.equal('2-MDD-vpt-23.1.R')
    expect(tripData.runID).to.equal('C036')
    expect(tripData.direction).to.equal('Up')
    expect(tripData.isRRB).to.be.false

    expect(tripData.stops[0].stopName).to.equal('East Pakenham Railway Station')
    expect(tripData.stops[0].stopGTFSID).to.equal('26506')
    expect(tripData.stops[0].departureTime).to.equal('07:43')
    expect(tripData.stops[0].departureTimeMinutes).to.equal(7*60 + 43)
    expect(tripData.stops[0].platform).to.equal('1')
    expect(tripData.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T21:44:00.000Z') // Fallback if no data provided
    expect(tripData.stops[0].actualDepartureTime.toISOString()).to.equal('2025-06-05T21:44:00.000Z')
    expect(tripData.stops[0].allowPickup).to.be.true
    expect(tripData.stops[0].allowDropoff).to.be.false

    expect(tripData.stops[1].stopName).to.equal('Pakenham Railway Station')
    expect(tripData.stops[1].stopGTFSID).to.equal('vic:rail:PKM')
    expect(tripData.stops[1].departureTime).to.equal('07:46')
    expect(tripData.stops[1].departureTimeMinutes).to.equal(7*60 + 46)
    expect(tripData.stops[1].platform).to.equal('1')
    expect(tripData.stops[1].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T21:46:00.000Z')
    expect(tripData.stops[1].actualDepartureTime.toISOString()).to.equal('2025-06-05T21:46:00.000Z')
  })
})