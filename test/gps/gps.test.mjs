import { LokiDatabaseConnection } from '@transportme/database'
import { expect } from 'chai'
import { getRelevantTrips, getTripData } from '../../modules/new-tracker/gps/update-trips.mjs'
import utils from '../../utils.js'
import td8507Live from './sample-data/td8507-live.mjs'
import styRoute from './sample-data/sty-route.mjs'

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
})