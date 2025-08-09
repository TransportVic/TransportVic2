import config from '../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import utils from '../utils.js'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect({})
await database.adminCommand({ logRotate: 'server' })

const now = utils.now()

if (config.databaseLog) {
  const files = await fs.readdir(config.databaseLog)
  for (let file of files) {
    if (file.endsWith('.log')) continue
    let timeData = file.slice(-19)
    let date = `${timeData.slice(0, 10)}T${timeData.slice(11).replace(/-/g, ':')}Z`
    let time = utils.parseTime(date)

    if (!time || now.diff(time, 'days') > 14) {
      await fs.unlink(path.join(dir, file))
    }
  }
}

const logDir = path.join(__dirname, '..', 'logs')
const logFiles = await fs.readdir(logDir)

for (const log of logFiles) {
  const date = utils.parseDate(log)
  if (!date || now.diff(date, 'days') > 14) {
    await fs.rm(path.join(logDir, log), { recursive: true })
  }
}

process.exit(0)