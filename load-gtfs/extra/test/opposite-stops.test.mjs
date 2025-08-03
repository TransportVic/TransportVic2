import { LokiDatabaseConnection } from '@transportme/database'
import { expect } from 'chai'
import { getFirstMatchingStop, matchOppositeStops } from '../load-opposite-stops.mjs'
import stops670 from './sample-data/stops-670.mjs'
import route670 from './sample-data/route-670.mjs'

import stops703 from './sample-data/stops-703.mjs'
import route703 from './sample-data/route-703.mjs'

const clone = o => JSON.parse(JSON.stringify(o))

describe('The opposite stops loader', () => {
  beforeEach(async function() {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('gtfs-stops')
    let routes = await database.createCollection('gtfs-routes')

    this.database = database
    this.stops = stops
    this.routes = routes
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

  it('Matches stops with different names on opposite sides of the road', async function() {
    await this.stops.createDocuments(clone(stops670))
    await this.routes.createDocument(clone(route670))

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

    expect((await stops.findDocument({
      stopName: 'Sheppards Lane/Maroondah Highway'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Dress Circle Lane/Maroondah Highway'
    }))._id)

    expect((await stops.findDocument({
      stopName: 'Dress Circle Lane/Maroondah Highway'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Sheppards Lane/Maroondah Highway'
    }))._id)
  })

  it('Does not set an opposite stop where not needed', async function() {
    await this.stops.createDocuments(clone(stops670))
    await this.routes.createDocument(clone(route670))

    await matchOppositeStops(this.database)
    let stops = await this.database.getCollection('gtfs-stops')

    expect((await stops.findDocument({
      stopName: 'Lilydale Railway Station'
    })).oppositeStopID).not.exist

    expect((await stops.findDocument({
      stopName: 'Chirnside Park Shopping Centre/Maroondah Highway'
    })).oppositeStopID).to.not.exist
  })

  it('Matches the stop with the closest distance, not the first one it finds (dir 0)', async function() {
    await this.stops.createDocuments(clone(stops703))
    await this.routes.createDocument(clone(route703))

    await matchOppositeStops(this.database)
    let stops = await this.database.getCollection('gtfs-stops')

    expect((await stops.findDocument({
      stopName: 'Davies Street/Centre Road'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Hampton Street/Centre Road'
    }))._id)

    expect((await stops.findDocument({
      stopName: 'Hampton Street/Centre Road'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Davies Street/Centre Road'
    }))._id)
  })

  it('Matches the stop with the closest distance, not the first one it finds (dir 1)', async function() {
    await this.stops.createDocuments(clone(stops703))
    let route = clone(route703)
    route.directions.reverse()
    await this.routes.createDocument(route)

    await matchOppositeStops(this.database)
    let stops = await this.database.getCollection('gtfs-stops')
    expect((await stops.findDocument({
      stopName: 'Davies Street/Centre Road'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Hampton Street/Centre Road'
    }))._id)

    expect((await stops.findDocument({
      stopName: 'Hampton Street/Centre Road'
    })).oppositeStopID).to.equal((await stops.findDocument({
      stopName: 'Davies Street/Centre Road'
    }))._id)
  })

  it('Should not end up 3-way stop at branches (dir 0)', async function() {
    await this.stops.createDocuments(clone(stops703))
    await this.routes.createDocument(clone(route703))

    await matchOppositeStops(this.database)
    let stops = await this.database.getCollection('gtfs-stops')

    expect((await stops.findDocument({
      stopName: 'Centre Road/Hampton Street'
    })).oppositeStopID).to.not.exist
  })

  it('Should not end up 3-way stop at branches (dir 1)', async function() {
    await this.stops.createDocuments(clone(stops703))
    let route = clone(route703)
    route.directions.reverse()
    await this.routes.createDocument(route)

    await matchOppositeStops(this.database)
    let stops = await this.database.getCollection('gtfs-stops')

    expect((await stops.findDocument({
      stopName: 'Centre Road/Hampton Street'
    })).oppositeStopID).to.not.exist
  })
})