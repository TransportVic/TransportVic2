const fetch = require('node-fetch')
const fs = require('fs')
const {spawn} = require('child_process')
const DatabaseConnection = require('../database/DatabaseConnection')
const ws = require('ws')
const utils = require('../utils')
const async = require('async')

const config = require('../config')
const urls = require('../urls')
const postDiscordUpdate = require('../modules/discord-integration')
const downloadGTFS = require('../update-gtfs')
const path = require('path')

let urlMask = []

Object.keys(urls).forEach(urlName => {
  let url = urls[urlName].replace(/{.+/, '')
  urlMask.push(url)
})

async function discordUpdate(text) {
  await postDiscordUpdate('timetables', text)
}

function broadcast(data) {
}

let lastLastModified
try {
  lastLastModified = fs.readFileSync(__dirname + '/last-modified').toString()
} catch (e) {
  console.log('No lastModified, downloading data')
}

function spawnProcess(cmd, args, finish) {
  let childProcess = spawn(cmd, args)

  childProcess.stdout.on('data', data => {
    process.stdout.write(data)
  })
  childProcess.stderr.on('data', data => {
    process.stderr.write(data)
  })
  childProcess.on('close', code => {
    if (finish) {
      finish()
    } else {
      console.log(`finished with code ${code}`)
    }
  })
}

async function updateTimetables() {
  let database = new DatabaseConnection(config.databaseURL, config.gtfsDatabaseName)
  return new Promise(resolve => {
    database.connect(async err => {
      let collections = ['stops', 'routes', 'gtfs timetables', 'timetables']

      await async.forEach(collections, async collection => {
        try {
          await database.getCollection(collection).dropCollection()
        } catch (e) {}
      })

      console.log('Dropped stops, routes and gtfs timetables')
      await discordUpdate('[Updater]: Dropped stops, routes and gtfs timetables, loading data now.')

      let fileName = 'load-all'
      if (config.metroOnly) fileName += '-metro-only'
      await new Promise(r => spawnProcess('node', [path.join(__dirname, `../load-gtfs/${fileName}.mjs`)], r))

      await discordUpdate(`[Updater]: GTFS Timetables finished loading, took ${Math.round(utils.uptime() / 1000 / 60)}min`)
      console.log('Done!')

      process.exit()
    })
  })
}

console.log('Checking for updates...')

fetch(urls.gtfsFeed, {
  method: 'HEAD'
}).then(async res => {
  if (res.status !== 200) {
    console.log('Unable to download timetables: Bad Request Status', res.status)
    await discordUpdate(`[Updater]: Unable to download new timetables (HTTP ${res.status}), skipping update`)
    process.exit(2)
  }

  let lastModified = res.headers.get('last-modified')

  if (lastModified !== lastLastModified) {
    console.log('Outdated timetables: updating now...')
    console.log(new Date().toLocaleString())
    await discordUpdate('[Updater]: Updating timetables to revision ' + lastModified)

    downloadGTFS(async status => {
      if (status === 0) {
        fs.writeFileSync(__dirname + '/last-modified', lastModified)
        console.log('Wrote last-modified', lastModified)
        await discordUpdate('[Updater]: Finished downloading new timetables')

        await updateTimetables()
      } else {
        await discordUpdate('[Updater]: Unable to download new timetables, skipping update')
        process.exit(1)
      }
    })
  } else {
    console.log('Timetables all good')
    await discordUpdate('[Updater]: Timetables up to date, not updating')
    process.exit(0)
  }
}).catch(e => {
  console.error('Failed to update timetables', e)
  process.exit(1)
})

setTimeout(() => process.exit(1), 1000 * 60 * 60 * 1.5) // Hard fail after 90 minutes