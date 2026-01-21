import config from '../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import os from 'os'
import utils from '../utils.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tripDatabaseURL = new URL(config.tripDatabaseURL)
tripDatabaseURL.host = os.hostname()
tripDatabaseURL.searchParams.set('directConnection', 'true')

const database = new MongoDatabaseConnection(config.databaseURL, 'admin')
await database.connect({})
await database.adminCommand({ logRotate: 'server' })

const tripDatabase = new MongoDatabaseConnection(tripDatabaseURL.toString(), 'admin')
await tripDatabase.connect({})
await tripDatabase.adminCommand({ logRotate: 'server' })

const now = utils.now()

for (const folder of config.databaseLog) {
  const files = await fs.readdir(folder)
  for (const file of files) {
    if (file.endsWith('.log')) continue
    const timeData = file.slice(-19)
    const date = `${timeData.slice(0, 10)}T${timeData.slice(11).replace(/-/g, ':')}Z`
    const time = utils.parseTime(date)

    if (!time || now.diff(time, 'days') > 14) {
      await fs.unlink(path.join(folder, file))
    }
  }
}

const logDir = path.join(__dirname, '..', '..', 'logs')
const logFiles = await fs.readdir(logDir)

for (const log of logFiles) {
  const date = utils.parseDate(log)
  if (!date || now.diff(date, 'days') > 14) {
    await fs.rm(path.join(logDir, log), { recursive: true })
  }
}

process.exit(0)