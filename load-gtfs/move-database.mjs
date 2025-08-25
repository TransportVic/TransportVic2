import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }
import { runHealthCheck } from './health-check/check.mjs'
import discordIntegration from '../modules/discord-integration.js'
import utils from '../utils.js'
import url, { fileURLToPath } from 'url'
import fs from 'fs/promises'
import path from 'path'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const collections = ['stops', 'routes', 'gtfs timetables', 'timetables']

let start = new Date()

let adminConnection = new MongoDatabaseConnection(config.databaseURL, 'admin')
await adminConnection.connect()

async function moveCollection(name) {
  console.log('Moving', name)
  await adminConnection.runCommand({
    renameCollection: `${config.databaseName}.gtfs-${name}`,
    to: `${config.databaseName}.${name}`,
    dropTarget: true
  })
  console.log('Done moving', name)
}

const isSubset = config.railOnly || config.busOnly
const { outputText, hasCriticalFailure } = await runHealthCheck()
if (hasCriticalFailure && !isSubset) {
  console.log('Not moving database', outputText)

  let currentDay = utils.getYYYYMMDDNow()
  let logPath = path.join(__dirname, '..', 'logs', currentDay, 'gtfs-updater')
  let txtLogPath = path.join(__dirname, '..', 'logs', currentDay, 'gtfs-updater.txt')

  try {
    await fs.stat(logPath)
    await fs.copyFile(logPath, txtLogPath)
    await discordIntegration('gtfsHealthCheck', outputText, txtLogPath)
    await fs.rm(txtLogPath)
  } catch (e) {
    await discordIntegration('gtfsHealthCheck', outputText)
  }
} else {
  await Promise.all(collections.map(coll => moveCollection(coll)))
  await discordIntegration('gtfsHealthCheck', outputText)
  console.log('\nLoading all collections took', (new Date() - start) / 1000, 'seconds overall')
}

process.exit(0)