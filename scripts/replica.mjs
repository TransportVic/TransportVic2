import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }

const adminConnection = new MongoDatabaseConnection(config.databaseURL, 'admin')
await adminConnection.connect()

const replicaStatus = await adminConnection.runCommand({
  replSetGetStatus: 1
})

console.log(replicaStatus)

adminConnection.close()
process.exit(0)