import { MongoDatabaseConnection } from '@transportme/database'
import { setStopServices, setRouteStops } from '@transportme/load-ptv-gtfs'
import config from '../config.json' with { type: 'json' }
import directionIDMap from './directions.json' with { type: 'json' }

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let start = new Date()
console.log('Start', start)

await setStopServices(mongoDB, (count, total) => console.log('Loaded', count, '/', total, `(${(count / total * 100).toFixed(2)}%)`, 'stops'))
await setRouteStops(mongoDB, directionIDMap)

console.log('\nLoading stop services and route stops took', (new Date() - start) / 1000, 'seconds overall')
console.log('Time now is', new Date())
process.exit(0)