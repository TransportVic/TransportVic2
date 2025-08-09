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

for (let dir of config.databaseLog) {
  const files = await fs.readdir(dir)
  for (let file of files) {
    if (!file.endsWith('.log')) {
      await fs.unlink(path.join(dir, file))
    }
  }
}

const logDir = path.join(__dirname, '..', 'logs')
const logFiles = await fs.readdir(logDir)

let now = utils.now()
for (let log of logFiles) {
  let date = utils.parseDate(log)
  if (!date || now.diff(date, 'days') > 14) {
    await fs.rm(path.join(logDir, log), { recursive: true })
  }
}

process.exit(0)