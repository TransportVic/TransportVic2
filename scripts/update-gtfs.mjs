import fs from 'fs/promises'
import { spawn } from 'child_process'
import url from 'url'
import path from 'path'
import { MongoDatabaseConnection } from '@transportme/database'
import { PTVGTFS } from '@transportme/load-ptv-gtfs'

import utils from '../utils.js'
import config from '../config.json' with { type: 'json' }
import urls from '../urls.json' with { type: 'json' }
import postDiscordUpdate from '../modules/discord-integration.js'
import createLogger from '../init-loggers.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GTFS_COLLECTIONS = ['gtfs-stops', 'gtfs-routes', 'gtfs-gtfs timetables', 'gtfs-timetables']
const LAST_MODIFIED_FILE = path.join(__dirname, '..', 'gtfs', 'last-modified')
const LOGGER = await createLogger('gtfs-updater', 'GTFS-UPDATE')

async function discordUpdate(text) {
  try {
    await postDiscordUpdate('timetables', text)
  } catch (e) {}
}

let lastLastModified
try {
  lastLastModified = (await fs.readFile(LAST_MODIFIED_FILE)).toString()
} catch (e) {
  LOGGER.log('No lastModified, downloading data')
}

function spawnProcess(cmd, args) {
  return new Promise(resolve => {
    let childProcess = spawn(cmd, args)

    childProcess.stdout.on('data', data => {
      let lines = data.toString().trim().split('\n')
      for (let line of lines) LOGGER.log(line)
    })

    childProcess.stderr.on('data', data => {
      let lines = data.toString().trim().split('\n')
      for (let line of lines) LOGGER.err(line)
    })

    childProcess.on('close', code => {
      resolve()
    })
  })
}

async function updateTimetables() {
  let database = new MongoDatabaseConnection(config.databaseURL, config.gtfsDatabaseName)
  await database.connect({})

  for (let collection of GTFS_COLLECTIONS) {
    try {
      await database.getCollection(collection).dropCollection()
    } catch (e) {
    }
  }

  LOGGER.log('Dropped stops, routes and gtfs timetables')
  await discordUpdate('[Updater]: Dropped stops, routes and gtfs timetables, loading data now.')

  let fileName = 'load-all'
  if (config.railOnly) fileName += '-rail-only'
  await spawnProcess('node', [ path.join(__dirname, `../load-gtfs/${fileName}.mjs`) ])

  await discordUpdate(`[Updater]: GTFS Timetables finished loading, took ${Math.round(utils.uptime() / 1000 / 60)}min`)
  LOGGER.log('Done!')
}

LOGGER.log('Checking for updates...')
setTimeout(() => process.exit(1), 1000 * 60 * 60 * 1.5) // Hard fail after 90 minutes

let gtfs = new PTVGTFS(urls.gtfsFeed)
let lastModified = await gtfs.getPublishedDate()

if (lastModified.toISOString() !== lastLastModified) {
  LOGGER.log('Outdated timetables: updating to revision', lastModified.toLocaleString())
  await discordUpdate('[Updater]: Updating timetables to revision ' + lastModified)

  let gtfsFolder = path.join(__dirname, '..', 'gtfs')
  try { await fs.rm(gtfsFolder, { recursive: true }) } catch (e) {}
  try { await fs.mkdir(gtfsFolder) } catch (e) {}
  try {
    await gtfs.download(gtfsFolder)
    LOGGER.log('Finished downloading, unzipping')
    await discordUpdate('[Updater]: Finished downloading new timetables')
    await gtfs.unzip()
  } catch (err) {
    LOGGER.log('Error occured while downloading timetable', err)
    await discordUpdate('[Updater]: 🚨🚨 Unable to download new timetables 🚨🚨')
    process.exit(0)
  }

  await updateTimetables()
  await fs.writeFile(LAST_MODIFIED_FILE, lastModified.toISOString())
} else {
  LOGGER.log('Timetables all good')
  await discordUpdate('[Updater]: Timetables up to date, not updating')
}

process.exit(0)
