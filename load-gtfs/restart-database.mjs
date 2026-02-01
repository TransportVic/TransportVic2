import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }
import utils from '../utils.mjs'

let adminConnection = new MongoDatabaseConnection(config.databaseURL, 'admin')
await adminConnection.connect()

try {
  await adminConnection.runCommand({
    shutdown: 1
  })
} catch (e) {} // Expected to throw an error saying connection closed

await utils.sleep(1500)

process.exit(0)