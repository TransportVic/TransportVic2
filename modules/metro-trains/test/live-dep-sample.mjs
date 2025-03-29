import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { fetchLiveTrips } from '../get-departures.js'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let stops = mongoDB.getCollection('stops')
console.log(await fetchLiveTrips(await stops.findDocument({ stopName: 'Lilydale Railway Station' }), mongoDB, new Date()))
mongoDB.close()