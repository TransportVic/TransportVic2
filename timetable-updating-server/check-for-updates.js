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

async function discordUpdate(text) {
  await postDiscordUpdate('timetables', text)
}


global.gtfsUpdaterLog = []

let wsConnections = []
let wss = new ws.Server({ server })

function broadcast(data) {
  wsConnections.forEach(sconn => {
    sconn.send(JSON.stringify(data))
  })
}

wss.on('connection', async (conn, req) => {
  wsConnections.push(conn)
  conn.on('close', () => {
    wsConnections.splice(wsConnections.indexOf(conn), 1)
  })
})


let lastLastModified
try {
  lastLastModified = fs.readFileSync(__dirname + '/last-modified').toString()
} catch (e) {
  console.log('No lastModified, downloading data')
}

function spawnProcess(cmd, args, finish) {
  let childProcess = spawn(cmd, args)

  function processLines(data) {
    let lines = data.split('\n').filter(Boolean)
    lines.forEach(line => {
      if (line.match(/\d+ms http/)) {
        if (line.includes('discord')) return
        line = line.replace(/\&devid.+/, '').replace(/&access_token.+/, '')
      }

      broadcast({
        type: 'log-newline',
        line
      })
      gtfsUpdaterLog.push(line)
    })
  }

  childProcess.stdout.on('data', data => {
    let lines = data.toString()
    process.stdout.write(data)

    processLines(lines)
  })
  childProcess.stderr.on('data', data => {
    process.stderr.write(data.toString())
  })
  childProcess.on('close', code => {
    if (finish) {
      finish()
    } else {
      console.log(`finished with code ${code}`)

      broadcast({
        type: 'complete'
      })
    }
  })
}

async function updateTimetables() {
  let database = new DatabaseConnection(config.databaseURL, config.databaseName)
  return new Promise(resolve => {
    database.connect(async err => {
      let collections = ['stops', 'routes', 'gtfs timetables', 'timetables']

      await async.forEach(collections, async collection => {
        try {
          await database.getCollection(collection).dropCollection()
        } catch (e) {}
      })

      broadcast({
        type: 'log-newline',
        line: 'Dropped stops, routes and gtfs timetables'
      })
      console.log('Dropped stops, routes and gtfs timetables')
      await discordUpdate('[Updater]: Dropped stops, routes and gtfs timetables, loading data now.')

      await new Promise(r => spawnProcess('node', [path.join(__dirname, '../load-gtfs/load-all.mjs')], r))

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
})
