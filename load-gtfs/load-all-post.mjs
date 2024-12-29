import { MongoDatabaseConnection } from '@transportme/database'
import { setStopServices, setRouteStops } from '@transportme/load-ptv-gtfs'

let mongoDB = new MongoDatabaseConnection('mongodb://127.0.0.1:27017', 'test-db')
await mongoDB.connect()

let start = new Date()
console.log('Start', start)

await setStopServices(mongoDB, (count, total) => console.log('Loaded', count, '/', total, `(${(count / total * 100).toFixed(2)}%)`, 'stops'))
await setRouteStops(mongoDB)

console.log('\nLoading stop services and route stops took', (new Date() - start) / 1000, 'seconds overall')
console.log('Time now is', new Date())
process.exit(0)