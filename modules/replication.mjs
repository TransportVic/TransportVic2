import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }
import os from 'os'
import utils from '../utils.js'

function randomSleepTime() {
  return Math.random() * 3 + 0.2
}

export async function getReplicaSetStatus() {
  const adminConnection = new MongoDatabaseConnection(config.databaseURL, 'admin')
  await adminConnection.connect()

  const replicaStatus = await adminConnection.runCommand({
    replSetGetStatus: 1
  })

  await adminConnection.close()

  return replicaStatus
}

export async function getAvailableServers() {
  const replicaStatus = await getReplicaSetStatus()
  return replicaStatus.members
    .filter(m => m.stateStr === 'PRIMARY' || m.stateStr === 'SECONDARY')
    .map(m => m.name.split(':')[0])
}

export async function isActive(taskName) {
  const db = new MongoDatabaseConnection(config.databaseURL, `${config.databaseName}-control`)
  const hostname = os.hostname()

  await db.connect()
  const controlColl = db.getCollection('control')

  await utils.sleep(randomSleepTime())

  const initialTaskAssignment = await controlColl.findDocument({
    taskName,
    active: {
      $gte: +new Date() - 1000 * 5
    }
  }, {}, { level: 'majority' })

  if (!initialTaskAssignment) {
    const availableServers = await getAvailableServers()
    const targetServer = availableServers[Math.floor(Math.random() * availableServers.length)]
    await controlColl.createDocument({
      taskName, active: +new Date(), targetServer
    })
  }

  const finalTaskAssignment = await controlColl.findDocuments({
    taskName,
    active: {
      $gte: +new Date() - 1000 * 5
    }
  }, {}, { level: 'majority' }).sort({ active: 1 }).next()

  await db.close()

  return finalTaskAssignment.targetServer === hostname
}

export async function isPrimary() {
  const hostname = os.hostname()
  const replicaStatus = await getReplicaSetStatus()

  const primary = replicaStatus.members
    .find(m => m.stateStr === 'PRIMARY')
  
  return primary && primary.name.split(':')[0] === hostname
}