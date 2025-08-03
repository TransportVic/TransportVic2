import { LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import { expect } from 'chai'
import dbStops from './sample-data/stops.mjs'
import route670 from './sample-data/route-670.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clone = o => JSON.parse(JSON.stringify(o))

describe('The opposite stops loader', () => {
  beforeEach(async function() {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')
    await stops.createDocuments(clone(dbStops))
    await routes.createDocument(clone(route670))

    this.database = database
  })

  it.only('test', async function() {
    console.log(this.database)
  })
})