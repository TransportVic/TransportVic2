import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }

const collections = ['stops', 'routes', 'gtfs timetables']

let start = new Date()

let adminConnection = new MongoDatabaseConnection(config.databaseURL, 'admin')
await adminConnection.connect()

async function moveCollection(name) {
  console.log('Moving', name)
  await adminConnection.runCommand({
    renameCollection: `${config.gtfsDatabaseName}.${name}`,
    to: `${config.databaseName}.${name}`,
    dropTarget: true
  })
  console.log('Done moving', name)
}

await Promise.all(collections.map(coll => moveCollection(coll)))

console.log('\nLoading all collections took', (new Date() - start) / 1000, 'seconds overall')

process.exit(0)