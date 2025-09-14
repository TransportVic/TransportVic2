import { LokiDatabaseConnection } from '@transportme/database'
import { expect } from 'chai'
import { getRelevantTrips } from '../../modules/new-tracker/gps/update-trips.mjs'
import utils from '../../utils.js'

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
})