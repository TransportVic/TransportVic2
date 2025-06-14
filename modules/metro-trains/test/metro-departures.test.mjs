import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import sampleLiveTrips from '../../departures/test/sample-data/sample-live-trips.json' with { type: 'json' }
import sampleSchTrips from '../../departures/test/sample-data/sample-sch-trips.json' with { type: 'json' }
import alamein from '../../departures/test/sample-data/alamein.json' with { type: 'json' }
import riversdale from '../../departures/test/sample-data/riversdale.json' with { type: 'json' }

import ephTrips from '../../departures/test/sample-data/eph-clp-forming.json' with { type: 'json' }
import pkmStops from '../../new-tracker/test/sample-data/pkm-stops-db.json' with { type: 'json' }
import getDepartures from '../get-departures.js'

let clone = o => JSON.parse(JSON.stringify(o))

const db = new LokiDatabaseConnection()
db.connect()
await (await db.createCollection('gtfs timetables')).createDocuments(clone(sampleSchTrips))
await (await db.createCollection('live timetables')).createDocuments(clone(sampleLiveTrips))

describe('The metro departures class', () => {
  it('Should return key departure data extracted from the trips returned', async () => {
    let departures = await getDepartures(alamein, db, null, null, new Date('2025-03-28T20:40:00.000Z'))
    expect(departures.length).to.equal(4)
    expect(departures[0].scheduledDepartureTime.toISOString()).to.equal('2025-03-28T20:48:00.000Z')
    expect(departures[0].estimatedDepartureTime.toISOString()).to.equal('2025-03-28T20:51:00.000Z')
    expect(departures[0].actualDepartureTime.toISOString()).to.equal('2025-03-28T20:51:00.000Z')

    expect(departures[0].runID).to.equal('2316')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.false
    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].origin).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Camberwell')
    expect(departures[0].direction).to.equal('Up')
    expect(departures[0].viaCityLoop).to.be.false
    expect(departures[0].isSkippingLoop).to.be.null
    expect(departures[0].viaAltonaLoop).to.be.null
    expect(departures[0].isRailReplacementBus).to.be.false
    expect(departures[0].departureDay).to.equal('20250329')

    expect(departures[0].allStops[0]).to.equal('Alamein')
    expect(departures[0].allStops.slice(-1)[0]).to.equal('Camberwell')

    expect(departures[0].futureStops[0]).to.equal('Ashburton')
    expect(departures[0].futureStops.slice(-1)[0]).to.equal('Camberwell')
    
    expect(departures[0].fleetNumber).to.deep.equal(["915M", "1658T", "916M", "943M", "1672T", "944M"])
    expect(departures[0].vehicle.type).to.equal('Xtrapolis')
    expect(departures[0].vehicle.size).to.equal(6)
    expect(departures[0].vehicle.consist).to.deep.equal(["915M", "1658T", "916M", "943M", "1672T", "944M"])
    
    expect(departures[2].fleetNumber).to.be.null
    expect(departures[2].vehicle).to.be.null

    expect(departures[3].scheduledDepartureTime.toISOString()).to.equal('2025-03-28T21:48:00.000Z')
    expect(departures[3].estimatedDepartureTime).to.be.null
    expect(departures[3].actualDepartureTime).to.equal(departures[3].scheduledDepartureTime)

    expect(departures[3].fleetNumber).to.deep.equal(['921M', '1661T', '922M'])
    expect(departures[3].vehicle.type).to.equal('Xtrapolis')
    expect(departures[3].vehicle.size).to.equal(3)
    expect(departures[3].vehicle.consist).to.deep.equal(['921M', '1661T', '922M'])
  })

  it('Should return the departure trip\'s new origin and destination if it was cancelled', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let trip = clone(sampleLiveTrips)[0]
    trip.stopTimings[2].cancelled = true // BWD
    trip.stopTimings[6].cancelled = true // CAM

    await (await db.createCollection('live timetables')).createDocument(trip)

    let departures = await getDepartures(alamein, db, null, null, new Date('2025-03-28T20:40:00.000Z'))

    expect(departures[0].runID).to.equal('2316')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.false
    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].origin).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Riversdale')

    expect(departures[0].trueOrigin).to.equal('Alamein')
    expect(departures[0].trueDestination).to.equal('Camberwell')
  })

  it('Should return the departure trip\'s new origin and destination if it was extended', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let trip = clone(sampleLiveTrips)[0]
    trip.stopTimings[0].additional = true // ALM
    trip.stopTimings[2].additional = true // BWD
    trip.stopTimings[6].additional = true // CAM

    await (await db.createCollection('live timetables')).createDocument(trip)

    let departures = await getDepartures(alamein, db, null, null, new Date('2025-03-28T20:40:00.000Z'))

    expect(departures[0].runID).to.equal('2316')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.false
    expect(departures[0].routeName).to.equal('Alamein')
    expect(departures[0].origin).to.equal('Alamein')
    expect(departures[0].destination).to.equal('Camberwell')

    expect(departures[0].trueOrigin).to.equal('Ashburton')
    expect(departures[0].trueDestination).to.equal('Riversdale')
  })

  it('Should return the original destination if viewing the trip from a cancelled stop', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let trip = clone(sampleLiveTrips)[0]
    trip.stopTimings[4].cancelled = true // WSN
    trip.stopTimings[5].cancelled = true // RIV
    trip.stopTimings[6].cancelled = true // CAM

    await (await db.createCollection('live timetables')).createDocument(trip)

    let almDepartures = await getDepartures(alamein, db, null, null, new Date('2025-03-28T20:40:00.000Z'))

    expect(almDepartures[0].runID).to.equal('2316')
    expect(almDepartures[0].cancelled).to.be.false
    expect(almDepartures[0].origin).to.equal('Alamein')
    expect(almDepartures[0].destination).to.equal('Hartwell')
    expect(almDepartures[0].trueOrigin).to.equal('Alamein')
    expect(almDepartures[0].trueDestination).to.equal('Camberwell')

    let rivDepartures = await getDepartures(riversdale, db, null, null, new Date('2025-03-28T20:40:00.000Z'))
    expect(rivDepartures[0].runID).to.equal('2316')
    expect(rivDepartures[0].cancelled).to.be.true
    expect(rivDepartures[0].origin).to.equal('Alamein')
    expect(rivDepartures[0].destination).to.equal('Camberwell')
    expect(rivDepartures[0].trueOrigin).to.equal('Alamein')
    expect(rivDepartures[0].trueDestination).to.equal('Camberwell')
  })

  it('Should set the destination as City Loop if needed', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()
    
    let trip = clone(sampleLiveTrips[4])
    await (await db.createCollection('live timetables')).createDocument(trip)

    let departures = await getDepartures(alamein, db, null, null, new Date('2025-06-05T19:38:00.000Z'))

    expect(departures[0].runID).to.equal('2800')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].destination).to.equal('City Loop')
    expect(departures[0].trueDestination).to.equal('City Loop')
  })

  it('Should keep City Loop as the true destination if it was shorted', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let trip = clone(sampleLiveTrips[4])
    trip.stopTimings.slice(3).forEach(stop => stop.cancelled = true)
    await (await db.createCollection('live timetables')).createDocument(trip)

    let departures = await getDepartures(riversdale, db, null, null, new Date('2025-06-05T19:38:00.000Z'))

    expect(departures[0].runID).to.equal('2800')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].destination).to.equal('Camberwell')
    expect(departures[0].trueDestination).to.equal('City Loop')
  })

  it('Should keep City Loop as the true destination it bypasses the loop', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let trip = clone(sampleLiveTrips[4])
    trip.stopTimings.slice(4, -1).forEach(stop => stop.cancelled = true)
    await (await db.createCollection('live timetables')).createDocument(trip)

    let departures = await getDepartures(riversdale, db, null, null, new Date('2025-06-05T19:38:00.000Z'))

    expect(departures[0].runID).to.equal('2800')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].destination).to.equal('Flinders Street')
    expect(departures[0].trueDestination).to.equal('City Loop')
  })

  it('Should show the trip as cancelled if viewing on the last stop before cancellation', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let trip = clone(sampleLiveTrips[4])
    trip.stopTimings.slice(2).forEach(stop => stop.cancelled = true)
    await (await db.createCollection('live timetables')).createDocument(trip)

    let departures = await getDepartures(riversdale, db, null, null, new Date('2025-06-05T19:38:00.000Z'))

    expect(departures[0].runID).to.equal('2800')
    expect(departures[0].platform).to.equal('1')
    expect(departures[0].cancelled).to.be.true
    expect(departures[0].destination).to.equal('City Loop')
    expect(departures[0].trueDestination).to.equal('City Loop')
  })

  it('Should return the next trip\'s data within the City Loop', async () => {
    let db = new LokiDatabaseConnection()
    db.connect()

    let stops = await db.createCollection('stops')
    await stops.createDocuments(clone(pkmStops))
    await (await db.createCollection('live timetables')).createDocuments(clone(ephTrips))

    let par = await stops.findDocument({ stopName: "Parliament Railway Station" })
    let departures = await getDepartures(par, db, null, null, new Date('2025-06-10T19:17:00.000Z'))

    expect(departures[0].runID).to.equal('C000')
    expect(departures[0].platform).to.equal('2')
    expect(departures[0].destination).to.equal('City Loop')
    expect(departures[0].trueDestination).to.equal('City Loop')

    expect(departures[0].formingDestination).to.equal('East Pakenham')
    expect(departures[0].formingRunID).to.equal('C005')
    expect(departures[0].futureFormingStops).to.deep.equal([
      'Melbourne Central',
      'Flagstaff',
      'Southern Cross',
      'Flinders Street',
      'Richmond',
      'East Pakenham'
    ])
  })
})