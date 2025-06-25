import { MongoDatabaseConnection } from '@transportme/database'
import { setRouteStops } from '@transportme/load-ptv-gtfs'
import config from '../config.json' with { type: 'json' }
import directionIDMap from './directions.json' with { type: 'json' }

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let start = new Date()
console.log('Start', start)

await setRouteStops(mongoDB, directionIDMap, (count, total) => console.log('Updated', count, '/', total, `(${(count / total * 100).toFixed(2)}%)`, 'routes'))

console.log('\nLoading route stops took', (new Date() - start) / 1000, 'seconds overall')
console.log('Time now is', new Date())
process.exit(0)