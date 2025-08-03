import { LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import { expect } from 'chai'
import dbStops from './sample-data/stops.mjs'
import route670 from './sample-data/route-670.mjs'
import { getFirstMatchingStop, matchOppositeStops } from '../load-opposite-stops.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clone = o => JSON.parse(JSON.stringify(o))

describe('The opposite stops loader', () => {
  beforeEach(async function() {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('gtfs-stops')
    let routes = await database.createCollection('gtfs-routes')
    await stops.createDocuments(clone(dbStops))
    await routes.createDocument(clone(route670))

    this.database = database
  })

  describe('The getFirstMatchingStop function', () => {
    it('Matches the first stop in both directions that share the same name', () => {
      let firstStop = getFirstMatchingStop(
        route670.directions[0].stops.map(stop => stop.stopName),
        route670.directions[1].stops.map(stop => stop.stopName).reverse(),
      )
      expect(firstStop).to.equal('Chirnside Park Shopping Centre/Maroondah Highway')
    })
  })

  it.only('Matches stops with different names on opposite sides of the road', async function() {
    await matchOppositeStops(this.database)
    let stops = await this.database.getCollection('gtfs-stops')
    expect((await stops.findDocument({
      stopName: 'Albert Hill Road/Maroondah Highway'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'John Street/Maroondah Highway'
    }))._id)

    expect((await stops.findDocument({
      stopName: 'John Street/Maroondah Highway'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Albert Hill Road/Maroondah Highway'
    }))._id)
  })
})