import { expect } from 'chai'
import { getUpcomingTrips } from '../../new-tracker/metro/metro-gtfsr-trips.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import pkmStops from '../../new-tracker/test/sample-data/pkm-stops-db.json' with { type: 'json' }
import gtfsr_EPH from '../../new-tracker/test/sample-data/gtfsr-eph.json' with { type: 'json' }
import pkmSchTrip from '../../new-tracker/test/sample-data/eph-sch.json' with { type: 'json' }

import rceStops from '../../new-tracker/test/sample-data/rce-stops-db.json' with { type: 'json' }
import tdR202 from '../../new-tracker/test/sample-data/rce-R202.json' with { type: 'json' }
import tdR205 from '../../new-tracker/test/sample-data/rce-R205.json' with { type: 'json' }

import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import td0735_0737 from '../../new-tracker/test/sample-data/ccl-0735-0737-sch.json' with { type: 'json' }
import cclDepartures from '../../new-tracker/test/sample-data/ccl-departures.json' with { type: 'json' }
import { getDepartures } from '../../new-tracker/metro/metro-trips-departures.mjs'

import { updateTrip } from '../trip-updater.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

describe('The trip updater module', () => {
  it('Should create the trip if it does not exist', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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

    expect(await liveTimetables.countDocuments({})).to.equal(0)
    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))
    let tripData = await updateTrip(database, gtfsrTrips[0])
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    expect(tripData.mode).to.equal('metro train')
    expect(tripData.routeGTFSID).to.equal('2-PKM')
    expect(tripData.routeName).to.equal('Pakenham')
    expect(tripData.operationDay).to.equal('20250606')
    expect(tripData.operationDayMoment.toISOString()).to.equal('2025-06-05T14:00:00.000Z')
    expect(tripData.block).to.be.null
    // expect(tripData.tripID).to.equal('02-MDD--23-T5-1000')
    // expect(tripData.shapeID).to.equal('2-MDD-vpt-23.1.R')
    expect(tripData.runID).to.equal('C036')
    expect(tripData.direction).to.equal('Up')
    // expect(tripData.isRRB).to.be.false

    expect(tripData.stops[0].stopName).to.equal('East Pakenham Railway Station')
    expect(tripData.stops[0].stopGTFSID).to.equal('vic:rail:EPH')
    expect(tripData.stops[0].departureTime).to.equal('07:44')
    expect(tripData.stops[0].departureTimeMinutes).to.equal(7*60 + 44)
    expect(tripData.stops[0].platform).to.equal('1')
    expect(tripData.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T21:44:00.000Z') // Fallback if no data provided
    expect(tripData.stops[0].actualDepartureTime.toISOString()).to.equal('2025-06-05T21:44:00.000Z')
    expect(tripData.stops[0].allowPickup).to.be.true
    expect(tripData.stops[0].allowDropoff).to.be.false

    expect(tripData.stops[1].stopName).to.equal('Pakenham Railway Station')
    expect(tripData.stops[1].stopGTFSID).to.equal('vic:rail:PKM')
    expect(tripData.stops[1].departureTime).to.equal('07:46')
    expect(tripData.stops[1].departureTimeMinutes).to.equal(7*60 + 46)
    // expect(tripData.stops[1].platform).to.equal('1')
    expect(tripData.stops[1].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T21:46:00.000Z')
    expect(tripData.stops[1].actualDepartureTime.toISOString()).to.equal('2025-06-05T21:46:00.000Z')

    expect(tripData.changes.length).to.equal(0)
  })

  it('Should update the trip if it exists', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))
    gtfsrTrips[0].stops[14].scheduledDepartureTime = gtfsrTrips[0].stops[14].estimatedDepartureTime

    let tripData = await updateTrip(database, gtfsrTrips[0])
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    expect(tripData.mode).to.equal('metro train')
    expect(tripData.routeGTFSID).to.equal('2-PKM')
    expect(tripData.routeName).to.equal('Pakenham')
    expect(tripData.operationDay).to.equal('20250606')
    expect(tripData.operationDayMoment.toISOString()).to.equal('2025-06-05T14:00:00.000Z')
    expect(tripData.block).to.be.equal('9337')
    expect(tripData.tripID).to.equal('02-PKM--53-T6-C036')
    expect(tripData.shapeID).to.equal('2-PKM-vpt-53.14.R')
    expect(tripData.runID).to.equal('C036')
    expect(tripData.direction).to.equal('Up')
    expect(tripData.isRRB).to.be.false

    expect(tripData.stops[0].stopName).to.equal('East Pakenham Railway Station')
    expect(tripData.stops[0].stopGTFSID).to.equal('vic:rail:EPH')
    expect(tripData.stops[0].departureTime).to.equal('07:43')
    expect(tripData.stops[0].departureTimeMinutes).to.equal(7*60 + 43)
    expect(tripData.stops[0].platform).to.equal('1')
    expect(tripData.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T21:43:00.000Z') // Fallback if no data provided
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

    let ephChange = tripData.changes.find(change => change.stopGTFSID === 'vic:rail:EPH')
    expect(ephChange).to.exist
    expect(ephChange.type).to.equal('platform-change')
    expect(ephChange.oldVal).to.equal('2')
    expect(ephChange.newVal).to.equal('1')
    expect(ephChange.timestamp).to.exist
  })

  it('Should insert an additional stop', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))
    gtfsrTrips[0].stops[14].scheduledDepartureTime = gtfsrTrips[0].stops[14].estimatedDepartureTime

    let tripData = await updateTrip(database, gtfsrTrips[0])
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    expect(tripData.stops[14].stopGTFSID).to.equal('vic:rail:OAK')
    expect(tripData.stops[14].departureTime).to.equal('08:34')
    expect(tripData.stops[14].departureTimeMinutes).to.equal(8*60 + 34)
    expect(tripData.stops[14].platform).to.equal('1')
    expect(tripData.stops[14].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T22:34:00.000Z')
    expect(tripData.stops[14].actualDepartureTime.toISOString()).to.equal('2025-06-05T22:34:00.000Z')
    expect(tripData.stops[14].allowPickup).to.be.true
    expect(tripData.stops[14].allowDropoff).to.be.true
    expect(tripData.stops[14].additional).to.be.true

    let oakChange = tripData.changes.find(change => change.stopGTFSID === 'vic:rail:OAK')
    expect(oakChange).to.exist
    expect(oakChange.type).to.equal('add-stop')
    expect(oakChange.timestamp).to.exist
  })

  it('Should use the estimated time if scheduled is unavailable when inserting an additional stop', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))

    let tripData = await updateTrip(database, gtfsrTrips[0])
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    expect(tripData.stops[14].stopGTFSID).to.equal('vic:rail:OAK')
    expect(tripData.stops[14].departureTime).to.equal('08:34')
    expect(tripData.stops[14].departureTimeMinutes).to.equal(8*60 + 34)
    expect(tripData.stops[14].scheduledDepartureTime.toISOString()).to.equal('2025-06-05T22:34:00.000Z')
    expect(tripData.stops[14].actualDepartureTime.toISOString()).to.equal('2025-06-05T22:34:00.000Z')
  })

  it('Should mark missing stops as cancelled', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let updateData = {
      operationDays: '20250606',
      runID: 'C036',
      routeGTFSID: '2-PKM',
      stops: [
        {
          stopName: 'East Pakenham Railway Station',
          platform: '1',
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedDepartureTime: new Date('2025-06-05T21:44:00.000Z')
        },
        {
          stopName: 'Pakenham Railway Station',
          platform: null,
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedArrivalTime: new Date('2025-06-05T21:45:00.000Z'),
          estimatedDepartureTime: new Date('2025-06-05T21:46:00.000Z'),
        }
      ]
    }

    let tripData = await updateTrip(database, updateData)
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    for (let stop of tripData.stops.slice(2)) {
      expect(stop.cancelled).to.be.true
    }

    let cdaChange = tripData.changes.find(change => change.stopGTFSID === 'vic:rail:CDA')
    expect(cdaChange).to.exist
    expect(cdaChange.type).to.equal('stop-cancelled')
    expect(cdaChange.oldVal).to.be.false
    expect(cdaChange.newVal).to.be.true
    expect(cdaChange.timestamp).to.exist
  })

  it('Should not mark missing stops as cancelled if told not to', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let updateData = {
      operationDays: '20250606',
      runID: 'C036',
      routeGTFSID: '2-PKM',
      stops: [
        {
          stopName: 'East Pakenham Railway Station',
          platform: '1',
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedDepartureTime: new Date('2025-06-05T21:44:00.000Z')
        },
        {
          stopName: 'Pakenham Railway Station',
          platform: null,
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedArrivalTime: new Date('2025-06-05T21:45:00.000Z'),
          estimatedDepartureTime: new Date('2025-06-05T21:46:00.000Z'),
        }
      ]
    }

    let tripData = await updateTrip(database, updateData, { skipStopCancellation: true })
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    for (let stop of tripData.stops.slice(2)) {
      expect(stop.cancelled).to.be.false
    }

    let cdaChange = tripData.changes.find(change => change.stopGTFSID === 'vic:rail:CDA')
    expect(cdaChange).to.not.exist
  })

  it('Should un-cancel stops that re appear', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let updateData = {
      operationDays: '20250606',
      runID: 'C036',
      routeGTFSID: '2-PKM',
      stops: [
        {
          stopName: 'East Pakenham Railway Station',
          platform: '1',
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedDepartureTime: new Date('2025-06-05T21:44:00.000Z')
        },
        {
          stopName: 'Pakenham Railway Station',
          platform: null,
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedArrivalTime: new Date('2025-06-05T21:45:00.000Z'),
          estimatedDepartureTime: new Date('2025-06-05T21:46:00.000Z'),
        }
      ]
    }

    let tripData = await updateTrip(database, updateData)
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    for (let stop of tripData.stops.slice(2)) {
      expect(stop.cancelled).to.be.true
    }

    let cdaChange = tripData.changes.find(change => change.stopGTFSID === 'vic:rail:CDA')
    expect(cdaChange).to.exist
    expect(cdaChange.type).to.equal('stop-cancelled')
    expect(cdaChange.oldVal).to.be.false
    expect(cdaChange.newVal).to.be.true
    expect(cdaChange.timestamp).to.exist

    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))
    tripData = await updateTrip(database, gtfsrTrips[0])    

    for (let stop of tripData.stops.slice(2)) {
      expect(stop.cancelled).to.be.false
    }

    let cdaChange2 = tripData.changes.filter(change => change.stopGTFSID === 'vic:rail:CDA')[1]
    expect(cdaChange2).to.exist
    expect(cdaChange2.type).to.equal('stop-cancelled')
    expect(cdaChange2.oldVal).to.be.true
    expect(cdaChange2.newVal).to.be.false
    expect(cdaChange2.timestamp).to.exist
  })

  it('Should not un-cancel stops that re appear if told to skip stop cancellations and data is not provided', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let updateData = {
      operationDays: '20250606',
      runID: 'C036',
      routeGTFSID: '2-PKM',
      stops: [
        {
          stopName: 'East Pakenham Railway Station',
          platform: '1',
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedDepartureTime: new Date('2025-06-05T21:44:00.000Z')
        },
        {
          stopName: 'Pakenham Railway Station',
          platform: null,
          scheduledDepartureTime: null,
          cancelled: false,
          estimatedArrivalTime: new Date('2025-06-05T21:45:00.000Z'),
          estimatedDepartureTime: new Date('2025-06-05T21:46:00.000Z'),
        }
      ]
    }

    let tripData = await updateTrip(database, updateData)
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    for (let stop of tripData.stops.slice(2)) {
      expect(stop.cancelled).to.be.true
    }

    let cdaChange = tripData.changes.find(change => change.stopGTFSID === 'vic:rail:CDA')
    expect(cdaChange).to.exist
    expect(cdaChange.type).to.equal('stop-cancelled')
    expect(cdaChange.oldVal).to.be.false
    expect(cdaChange.newVal).to.be.true
    expect(cdaChange.timestamp).to.exist

    // Remove OAK additional
    let gtfsrResponse = clone(gtfsr_EPH)
    gtfsrResponse.entity[0].trip_update.stop_time_update = gtfsrResponse.entity[0].trip_update.stop_time_update.filter(stop => stop.stop_id !== '13722')

    let gtfsrTrips = await getUpcomingTrips(database, () => gtfsrResponse)
    gtfsrTrips[0].stops.forEach(stop => { delete stop.cancelled })

    tripData = await updateTrip(database, gtfsrTrips[0], { skipStopCancellation: true })

    for (let stop of tripData.stops.slice(2)) {
      expect(stop.cancelled).to.be.true
    }

    let cdaChange2 = tripData.changes.filter(change => change.stopGTFSID === 'vic:rail:CDA')[1]
    expect(cdaChange2).to.not.exist
  })

  it('Should mark trips as cancelled', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let gtfsrUpdate = clone(gtfsr_EPH)
    gtfsrUpdate.entity[0].trip_update.trip.schedule_relationship = 3
    gtfsrUpdate.entity[0].trip_update.stop_time_update = []

    let gtfsrTrips = await getUpcomingTrips(database, () => gtfsrUpdate)
    let tripData = await updateTrip(database, gtfsrTrips[0])
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    expect(tripData.cancelled).to.be.true
    expect(tripData.changes.length).to.equal(1)
    let tripChange = tripData.changes[0]
    expect(tripChange).to.exist
    expect(tripChange.type).to.equal('trip-cancelled')
    expect(tripChange.oldVal).to.be.false
    expect(tripChange.newVal).to.be.true
    expect(tripChange.timestamp).to.exist
  })

  it('Should ensure the changelog persists in the database', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))
    gtfsrTrips[0].stops[14].scheduledDepartureTime = gtfsrTrips[0].stops[14].estimatedDepartureTime

    await updateTrip(database, gtfsrTrips[0])
    await updateTrip(database, gtfsrTrips[0]) // Run the update twice - should only have 1 set of changes

    let timetable = await liveTimetables.findDocument({})
    expect(timetable.changes.length).to.equal(2)

    let ephChange = timetable.changes.find(change => change.stopGTFSID === 'vic:rail:EPH')
    expect(ephChange).to.exist
    expect(ephChange.type).to.equal('platform-change')
    expect(ephChange.oldVal).to.equal('2')
    expect(ephChange.newVal).to.equal('1')
    expect(ephChange.timestamp).to.exist

    gtfsrTrips[0].stops[8].platform = '3'
    await updateTrip(database, gtfsrTrips[0])
    timetable = await liveTimetables.findDocument({})
    expect(timetable.changes.length).to.equal(3)

    let dngChange = timetable.changes.find(change => change.stopGTFSID === 'vic:rail:DNG')
    expect(dngChange).to.exist
    expect(dngChange.type).to.equal('platform-change')
    expect(dngChange.oldVal).to.equal('2')
    expect(dngChange.newVal).to.equal('3')
    expect(dngChange.timestamp).to.exist
  })

  it('Should be able to handle trips being redirected', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(rceStops))
    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Flemington Racecourse",
      "cleanName" : "flemington-racecourse",
      "routeNumber" : null,
      "routeGTFSID" : "2-RCE",
      "operators" : [
        "Metro"
      ],
      "codedName" : "flemington-racecourse"
    })
    await liveTimetables.createDocument(clone(tdR202))

    expect(await liveTimetables.countDocuments({})).to.equal(1)

    let tripUdate = {
      operationDays: '20240224',
      runID: 'R202',
      routeGTFSID: '2-RCE',
      stops: [{
        stopName: 'Showgrounds Railway Station',
        platform: '1',
        scheduledDepartureTime: new Date('2024-02-23T22:29:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Flagstaff Railway Station',
        platform: '3',
        scheduledDepartureTime: new Date('2024-02-23T22:39:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Melbourne Central Railway Station',
        platform: '3',
        scheduledDepartureTime: new Date('2024-02-23T22:41:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Parliament Railway Station',
        platform: '3',
        scheduledDepartureTime: new Date('2024-02-23T22:43:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Flinders Street Railway Station',
        platform: '5',
        scheduledDepartureTime: new Date('2024-02-23T22:46:00.000Z'),
        cancelled: false
      }],
      cancelled: false
    }

    let trip = await updateTrip(database, tripUdate)
    expect(trip.stops[0].stopName).to.equal('Showgrounds Railway Station')
    expect(trip.stops[0].additional).to.be.false
    expect(trip.stops[0].cancelled).to.be.false

    expect(trip.stops[1].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stops[1].additional).to.be.false
    expect(trip.stops[1].cancelled).to.be.true

    expect(trip.stops[2].stopName).to.equal('Flagstaff Railway Station')
    expect(trip.stops[2].additional).to.be.true
    expect(trip.stops[2].cancelled).to.be.false

    expect(trip.stops[3].stopName).to.equal('Melbourne Central Railway Station')
    expect(trip.stops[3].additional).to.be.true
    expect(trip.stops[3].cancelled).to.be.false

    expect(trip.stops[4].stopName).to.equal('Parliament Railway Station')
    expect(trip.stops[4].additional).to.be.true
    expect(trip.stops[4].cancelled).to.be.false

    expect(trip.stops[5].stopName).to.equal('Flinders Street Railway Station')
    expect(trip.stops[5].additional).to.be.true
    expect(trip.stops[5].cancelled).to.be.false

    expect(trip.origin).to.equal('Showgrounds Railway Station')
    expect(trip.departureTime).to.equal('09:29')

    expect(trip.destination).to.equal('Flinders Street Railway Station')
    expect(trip.destinationArrivalTime).to.equal('09:46')
  })

  it('Should be able to handle trips being extended', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(rceStops))
    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Flemington Racecourse",
      "cleanName" : "flemington-racecourse",
      "routeNumber" : null,
      "routeGTFSID" : "2-RCE",
      "operators" : [
        "Metro"
      ],
      "codedName" : "flemington-racecourse"
    })
    await liveTimetables.createDocument(clone(tdR205))

    expect(await liveTimetables.countDocuments({})).to.equal(1)

    let tripUdate = {
      operationDays: '20240224',
      runID: 'R205',
      routeGTFSID: '2-RCE',
      stops: [{
        stopName: 'Flinders Street Railway Station',
        platform: '5',
        scheduledDepartureTime: new Date('2024-02-23T22:46:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Southern Cross Railway Station',
        platform: '11',
        scheduledDepartureTime: new Date('2024-02-23T22:49:00.000Z'),
        cancelled: false
      }, {
        stopName: 'North Melbourne Railway Station',
        platform: '2',
        scheduledDepartureTime: new Date('2024-02-23T22:52:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Showgrounds Railway Station',
        platform: '1',
        scheduledDepartureTime: new Date('2024-02-23T23:01:00.000Z'),
        cancelled: false
      }],
      cancelled: false
    }

    let trip = await updateTrip(database, tripUdate)
    expect(trip.stops[0].stopName).to.equal('Flinders Street Railway Station')
    expect(trip.stops[0].additional).to.be.true
    expect(trip.stops[0].cancelled).to.be.false

    expect(trip.stops[1].stopName).to.equal('Southern Cross Railway Station')
    expect(trip.stops[1].additional).to.be.false
    expect(trip.stops[1].cancelled).to.be.false
    expect(trip.stops[1].platform).to.equal('11')

    expect(trip.stops[2].stopName).to.equal('North Melbourne Railway Station')
    expect(trip.stops[2].additional).to.be.false
    expect(trip.stops[2].cancelled).to.be.false

    expect(trip.stops[3].stopName).to.equal('Showgrounds Railway Station')
    expect(trip.stops[3].additional).to.be.false
    expect(trip.stops[3].cancelled).to.be.false

    expect(trip.origin).to.equal('Flinders Street Railway Station')
    expect(trip.departureTime).to.equal('09:46')

    expect(trip.destination).to.equal('Showgrounds Railway Station')
    expect(trip.destinationArrivalTime).to.equal('10:01')
  })

  it('Should handle non-existent platform numbers', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(rceStops))
    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Flemington Racecourse",
      "cleanName" : "flemington-racecourse",
      "routeNumber" : null,
      "routeGTFSID" : "2-RCE",
      "operators" : [
        "Metro"
      ],
      "codedName" : "flemington-racecourse"
    })
    await liveTimetables.createDocument(clone(tdR205))

    expect(await liveTimetables.countDocuments({})).to.equal(1)

    let tripUdate = {
      operationDays: '20240224',
      runID: 'R205',
      routeGTFSID: '2-RCE',
      stops: [{
        stopName: 'Showgrounds Railway Station',
        platform: '2',
        scheduledDepartureTime: new Date('2024-02-23T23:01:00.000Z'),
        cancelled: false
      }],
      cancelled: false
    }

    let trip = await updateTrip(database, tripUdate)

    expect(trip.stops[2].stopName).to.equal('Showgrounds Railway Station')
    expect(trip.stops[2].platform).to.equal('2')
  })

  it('Should ensure the changelog persists in the database', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

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
    await liveTimetables.createDocument(clone(pkmSchTrip))

    expect(await liveTimetables.countDocuments({})).to.equal(1)
    let gtfsrTrips = await getUpcomingTrips(database, () => clone(gtfsr_EPH))
    gtfsrTrips[0].stops[14].scheduledDepartureTime = gtfsrTrips[0].stops[14].estimatedDepartureTime

    await updateTrip(database, gtfsrTrips[0])
    await updateTrip(database, gtfsrTrips[0]) // Run the update twice - should only have 1 set of changes

    let timetable = await liveTimetables.findDocument({})
    expect(timetable.changes.length).to.equal(2)

    let ephChange = timetable.changes.find(change => change.stopGTFSID === 'vic:rail:EPH')
    expect(ephChange).to.exist
    expect(ephChange.type).to.equal('platform-change')
    expect(ephChange.oldVal).to.equal('2')
    expect(ephChange.newVal).to.equal('1')
    expect(ephChange.timestamp).to.exist

    gtfsrTrips[0].stops[8].platform = '3'
    await updateTrip(database, gtfsrTrips[0])
    timetable = await liveTimetables.findDocument({})
    expect(timetable.changes.length).to.equal(3)

    let dngChange = timetable.changes.find(change => change.stopGTFSID === 'vic:rail:DNG')
    expect(dngChange).to.exist
    expect(dngChange.type).to.equal('platform-change')
    expect(dngChange.oldVal).to.equal('2')
    expect(dngChange.newVal).to.equal('3')
    expect(dngChange.timestamp).to.exist
  })

  it('Should not update the scheduled departure time for FSS on the up', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(rceStops))
    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Flemington Racecourse",
      "cleanName" : "flemington-racecourse",
      "routeNumber" : null,
      "routeGTFSID" : "2-RCE",
      "operators" : [
        "Metro"
      ],
      "codedName" : "flemington-racecourse"
    })
    let dbTrip = clone(tdR202)
    dbTrip.stopTimings[1].stopName = 'Flinders Street Railway Station'
    dbTrip.destination = 'Flinders Street Railway Station'
    dbTrip.stopTimings[1].stopGTFSID = 'vic:rail:FSS'

    await liveTimetables.createDocument(dbTrip)
    expect(await liveTimetables.countDocuments({})).to.equal(1)

    let tripUdate = {
      operationDays: '20240224',
      runID: 'R202',
      routeGTFSID: '2-RCE',
      stops: [{
        stopName: 'Showgrounds Railway Station',
        platform: '1',
        scheduledDepartureTime: new Date('2024-02-23T22:29:00.000Z'),
        cancelled: false
      }, {
        stopName: 'Flinders Street Railway Station',
        platform: '5',
        scheduledDepartureTime: new Date('2024-02-23T22:50:00.000Z'),
        cancelled: false
      }],
      cancelled: false
    }

    let trip = await updateTrip(database, tripUdate)

    expect(trip.stops[1].stopName).to.equal('Flinders Street Railway Station')
    expect(trip.stops[1].scheduledDepartureTime.toISOString()).to.equal('2024-02-23T22:39:00.000Z')

    expect(trip.origin).to.equal('Showgrounds Railway Station')
    expect(trip.departureTime).to.equal('09:29')

    expect(trip.destination).to.equal('Flinders Street Railway Station')
    expect(trip.destinationArrivalTime).to.equal('09:39')
  })

  it('Should create or update a fleet tracker entry', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    let liveTimetables = await database.createCollection('live timetables')
    let metroTrips = await database.createCollection('metro trips')

    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "Flemington Racecourse",
      "cleanName" : "flemington-racecourse",
      "routeNumber" : null,
      "routeGTFSID" : "2-RCE",
      "operators" : [
        "Metro"
      ],
      "codedName" : "flemington-racecourse"
    })
    await liveTimetables.createDocument(clone(tdR205))
    let tripUdate = {
      operationDays: '20240224',
      runID: 'R205',
      routeGTFSID: '2-RCE',
      stops: [],
      cancelled: false,
      consist: ['9001', '9101', '9201', '9301', '9701', '9801', '9901']
    }

    let trip = await updateTrip(database, tripUdate)
    expect(trip.vehicle.type).to.equal('HCMT')

    let trackerEntry = await metroTrips.findDocument({})
    expect(trackerEntry.date).to.equal('20240224')
    expect(trackerEntry.runID).to.equal('R205')
    expect(trackerEntry.origin).to.equal('Southern Cross')
    expect(trackerEntry.departureTime).to.equal('09:49')
    expect(trackerEntry.destination).to.equal('Showgrounds')
    expect(trackerEntry.destinationArrivalTime).to.equal('10:01')
    expect(trackerEntry.consist).to.deep.equal(['9001', '9101', '9201', '9301', '9701', '9801', '9901'])
  })

  it('Should use strict time matching for CCL trips', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let routes = await database.createCollection('routes')
    let stops = await database.createCollection('stops')
    let liveTimetables = await database.createCollection('live timetables')

    await stops.createDocuments(clone(pkmStops))
    await liveTimetables.createDocuments(clone(td0735_0737))
    await routes.createDocument({
      "mode" : "metro train",
      "routeName" : "City Circle",
      "cleanName" : "city-circle",
      "routeNumber" : null,
      "routeGTFSID" : "2-CCL",
      "operators" : [
        "Metro"
      ],
      "codedName" : "city-circle"
    })

    let stubAPI = new StubAPI()
    stubAPI.setResponses([ cclDepartures ])
    stubAPI.skipErrors()

    let ptvAPI = new PTVAPI(stubAPI)
    ptvAPI.addMetroSite(stubAPI)

    let tripData = await getDepartures(database, ptvAPI)
    let td0735 = await updateTrip(database, tripData[0])

    expect(td0735.stops[0].stopGTFSID).to.equal('vic:rail:FSS')
    expect(td0735.stops[0].departureTime).to.equal('10:53')
    expect(td0735.stops[0].departureTimeMinutes).to.equal(10*60 + 53)
    expect(td0735.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-06-14T00:53:00.000Z')
    expect(td0735.stops[0].estimatedDepartureTime).to.not.exist

    expect(td0735.stops[5].stopGTFSID).to.equal('vic:rail:FSS')
    expect(td0735.stops[5].departureTime).to.equal('11:05')
    expect(td0735.stops[5].departureTimeMinutes).to.equal(11*60 + 5)
    expect(td0735.stops[5].scheduledDepartureTime.toISOString()).to.equal('2025-06-14T01:05:00.000Z')
    expect(td0735.stops[5].estimatedDepartureTime).to.not.exist

    let td0737 = await updateTrip(database, tripData[1])

    expect(td0737.stops[0].stopGTFSID).to.equal('vic:rail:FSS')
    expect(td0737.stops[0].departureTime).to.equal('11:13')
    expect(td0737.stops[0].departureTimeMinutes).to.equal(11*60 + 13)
    expect(td0737.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-06-14T01:13:00.000Z')
    expect(td0737.stops[0].estimatedDepartureTime.toISOString()).to.equal('2025-06-14T01:14:00.000Z')

    expect(td0737.stops[5].stopGTFSID).to.equal('vic:rail:FSS')
    expect(td0737.stops[5].departureTime).to.equal('11:25')
    expect(td0737.stops[5].departureTimeMinutes).to.equal(11*60 + 25)
    expect(td0737.stops[5].scheduledDepartureTime.toISOString()).to.equal('2025-06-14T01:25:00.000Z')
    expect(td0737.stops[5].estimatedDepartureTime).to.not.exist
  })

  it('Should not update the trip if the provided scheduled start time does not match', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let routes = await database.createCollection('routes')
    let stops = await database.createCollection('stops')
    let liveTimetables = await database.createCollection('live timetables')

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

    await liveTimetables.createDocument(clone(pkmSchTrip))
    let gtfsrUpdate = clone(gtfsr_EPH)
    gtfsrUpdate.entity[0].trip_update.trip.start_time = '15:55:00'

    let gtfsrTrips = await getUpcomingTrips(database, () => gtfsrUpdate)
    let tripData = await updateTrip(database, gtfsrTrips[0])

    expect(tripData).to.be.null
  })

  it('Should match a scheduled start time past midnight', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let routes = await database.createCollection('routes')
    let stops = await database.createCollection('stops')
    let liveTimetables = await database.createCollection('live timetables')

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

    let trip = clone(pkmSchTrip)
    trip.departureTime = '00:29'
    trip.stopTimings[0] = {
      ...trip.stopTimings[0],
			arrivalTime: "00:29",
			arrivalTimeMinutes: 1469,
			departureTime: "00:29",
			departureTimeMinutes: 1469,
			estimatedDepartureTime: null,
			scheduledDepartureTime: "2025-06-16T14:29:00.000Z",
			actualDepartureTimeMS: 1750084140000,
    }

    await liveTimetables.createDocument(trip)
    let gtfsrUpdate = clone(gtfsr_EPH)
    gtfsrUpdate.entity[0].trip_update.trip.start_time = '24:29:00'

    let gtfsrTrips = await getUpcomingTrips(database, () => gtfsrUpdate)
    let tripData = await updateTrip(database, gtfsrTrips[0])

    expect(tripData).to.exist
  })
})