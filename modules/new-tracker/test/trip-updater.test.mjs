import { expect } from 'chai'
import { getUpcomingTrips } from '../metro-gtfsr-trips.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import pkmStops from './sample-data/pkm-stops-db.json' with { type: 'json' }
import gtfsr_EPH from './sample-data/gtfsr-eph.json' with { type: 'json' }
import pkmSchTrip from './sample-data/eph-sch.json' with { type: 'json' }
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
  })
})