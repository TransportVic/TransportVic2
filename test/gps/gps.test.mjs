import { LokiDatabaseConnection } from '@transportme/database'
import { expect } from 'chai'
import { getEstimatedArrivalTime, getRelevantTrips, getTripData, updateTrips } from '../../modules/new-tracker/gps/update-trips.mjs'
import utils from '../../utils.mjs'
import td8507Live from './sample-data/td8507-live.mjs'
import styRoute from './sample-data/sty-route.mjs'
import styStops from '../metro/tracker/sample-data/sty-stops.json' with { type: 'json' }
import TripUpdater from '../../modules/new-tracker/trip-updater.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The GPS tracker', () => {
  it('Filters only relevant trips', async () => {
    const trips = await getRelevantTrips(() => [{
      location: {
        type: 'Point',
        coordinates: [0, 0]
      },
      updateTime: utils.now(),
      operator: 'Ventura Bus Lines'
    }, {
      location: {
        type: 'Point',
        coordinates: [0, 0]
      },
      updateTime: utils.now(),
      operator: 'CDC Melbourne'
    }, {
      location: {
        type: 'Point',
        coordinates: [0, 0]
      },
      updateTime: utils.now(),
      operator: 'Metro Trains Melbourne'
    }], () => ['CDC Melbourne'])

    expect(trips.length).to.equal(1)
    expect(trips[0].operator).to.equal('CDC Melbourne')
  })

  it('Finds the next stop and distance for a given trip and gps position', async () => {
    let database = new LokiDatabaseConnection()
    let timetables = await database.createCollection('live timetables')
    let routes = await database.createCollection('routes')
    await timetables.createDocument(clone(td8507Live))
    await routes.createDocument(clone(styRoute))

    const { nextStop, prevStop, distance } = await getTripData({
      location: {
        type: 'Point',
        coordinates: [145.173440406409, -38.22145767839698]
      },
      updateTime: utils.parseTime('2025-09-14T03:19:00.000Z'),
      runID: '8507',
      operator: 'Metro Trains Melbourne'
    }, database)

    expect(prevStop).to.exist
    expect(prevStop.stopName).to.equal('Baxter Railway Station')
    expect(nextStop).to.exist
    expect(nextStop.stopName).to.equal('Somerville Railway Station')

    // Should be around 500m, give or take a bit
    expect(distance).to.be.greaterThanOrEqual(490)
    expect(distance).to.be.lessThanOrEqual(510)
  })

  it('Gets the estimated arrival time and delay at the next stop', async () => {
    let database = new LokiDatabaseConnection()
    let timetables = await database.createCollection('live timetables')
    let routes = await database.createCollection('routes')
    await timetables.createDocument(clone(td8507Live))
    await routes.createDocument(clone(styRoute))

    const positionData = {
      location: {
        type: 'Point',
        coordinates: [145.173440406409, -38.22145767839698]
      },
      updateTime: utils.parseTime('2025-09-14T03:19:50.000Z'),
      runID: '8507',
      operator: 'Metro Trains Melbourne'
    }

    const tripData = await getTripData(positionData, database)
    // Has around 500m to travel, will be late
    const { estimatedArrivalTime, arrDelay } = getEstimatedArrivalTime(positionData, tripData)
    expect(+estimatedArrivalTime).to.be.greaterThan(+new Date('2025-09-14T03:20:00.000Z'))
    expect(arrDelay).to.be.greaterThan(10) // Seconds
    expect(arrDelay).to.be.lessThanOrEqual(90) // Seconds
  })

  it('Updates the trip time estimates', async () => {
    let database = new LokiDatabaseConnection()
    let timetables = await database.createCollection('live timetables')
    let routes = await database.createCollection('routes')
    let stops = await database.createCollection('stops')

    await timetables.createDocument({
      ...clone(td8507Live),
      mode: 'regional train'
    })
    await routes.createDocument({
      ...clone(styRoute),
      mode: 'regional train'
    })
    await stops.createDocuments(clone(styStops).map(stop => {
      stop.bays.filter(bay => bay.mode === 'metro train').forEach(bay => bay.mode = 'regional train')
      return stop
    }))

    const positionData = {
      location: {
        type: 'Point',
        coordinates: [145.173440406409, -38.22145767839698]
      },
      updateTime: utils.parseTime('2025-09-14T03:20:45.000Z'), // Approx 1min late
      runID: '8507',
      operator: 'Metro Trains Melbourne'
    }
    await updateTrips(() => [positionData], () => ['Metro Trains Melbourne'], database, database)

    const td8507 = await timetables.findDocument({ runID: '8507' })
    expect(td8507.stopTimings[3].stopName).to.equal('Somerville Railway Station')
    expect(+new Date(td8507.stopTimings[3].estimatedDepartureTime)).to.be.greaterThanOrEqual(+new Date('2025-09-14T03:21:00.000Z'))
    expect(+new Date(td8507.stopTimings[3].estimatedDepartureTime)).to.be.lessThanOrEqual(+new Date('2025-09-14T03:21:20.000Z'))

    expect(td8507.stopTimings[4].stopName).to.equal('Tyabb Railway Station')
    expect(+new Date(td8507.stopTimings[4].estimatedDepartureTime)).to.be.greaterThanOrEqual(+new Date('2025-09-14T03:25:00.000Z'))
    expect(+new Date(td8507.stopTimings[4].estimatedDepartureTime)).to.be.lessThanOrEqual(+new Date('2025-09-14T03:25:20.000Z'))
  })

  it('Sets the vehicle where available', async () => {
    let database = new LokiDatabaseConnection()
    let timetables = await database.createCollection('live timetables')
    let routes = await database.createCollection('routes')
    let stops = await database.createCollection('stops')

    await timetables.createDocument({
      ...clone(td8507Live),
      mode: 'regional train'
    })
    await routes.createDocument({
      ...clone(styRoute),
      mode: 'regional train'
    })
    await stops.createDocuments(clone(styStops).map(stop => {
      stop.bays.filter(bay => bay.mode === 'metro train').forEach(bay => bay.mode = 'regional train')
      return stop
    }))

    const positionData = {
      location: {
        type: 'Point',
        coordinates: [145.173440406409, -38.22145767839698]
      },
      updateTime: utils.parseTime('2025-09-14T03:20:45.000Z'), // Approx 1min late
      vehicle: 'S7001',
      runID: '8507',
      operator: 'Metro Trains Melbourne'
    }
    await updateTrips(() => [positionData], () => ['Metro Trains Melbourne'], database, database)

    const td8507 = await timetables.findDocument({ runID: '8507' })
    expect(td8507.vehicle.consist).to.deep.equal(['S7001'])
  })

  after(TripUpdater.clearCaches)
})