const request = require('request')
const fs = require('fs')
const {spawn} = require('child_process')
const DatabaseConnection = require('../database/DatabaseConnection')
const ws = require('ws')

const config = require('../config.json')
const urls = require('../urls.json')
const discordUpdate = require('./discord-integration')

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

function spawnProcess(path, finish) {
  let childProcess = spawn(path)

  function processLines(data) {
    let lines = data.split('\n').map(e => e.trim()).filter(Boolean)
    lines.forEach(line => {
      if (line.match(/\d+ms http/)) {
        if (line.includes('discord')) return
        line = line.replace(/\&devid.+/, '')
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
      let stops = database.getCollection('stops')
      let routes = database.getCollection('routes')
      let gtfsTimetables = database.getCollection('gtfs timetables')
      let liveTimetables = database.getCollection('live timetables')
      let timetables = database.getCollection('timetables')

      try {
        await stops.dropCollection()
        await routes.dropCollection()
        await gtfsTimetables.dropCollection()
        await liveTimetables.dropCollection()
        await timetables.dropCollection()
      } catch (e) {
        console.log(e)
      }

      broadcast({
        type: 'log-newline',
        line: 'Dropped stops, routes and gtfs timetables'
      })
      console.log('Dropped stops, routes and gtfs timetables')
      await discordUpdate('[Updater]: Dropped stops, routes and gtfs timetables, loading data now.')

      spawnProcess(__dirname + '/../load-gtfs/load-all.sh', async () => {
        await discordUpdate(`[Updater]: GTFS Timetables finished loading, took ${Math.round(utils.uptime() / 1000 / 60)}min`)
        console.log('Done!')

        process.exit()
      })
    })
  })
}

console.log('Checking for updates...')

request.head(urls.gtfsFeed, async (err, resp, body) => {
  let lastModified = resp.headers['last-modified']
  if (lastModified !== lastLastModified) {
    console.log('Outdated timetables: updating now...')
    console.log(new Date().toLocaleString())
    await discordUpdate('[Updater]: Updating timetables to revision ' + lastModified)

    spawnProcess(__dirname + '/../update-gtfs.sh', async () => {
      fs.writeFileSync(__dirname + '/last-modified', lastModified)
      console.log('Wrote last-modified', lastModified)
      await discordUpdate('[Updater]: Finished downloading new timetables')

      await updateTimetables()
    })
  } else {
    console.log('Timetables all good')
    await discordUpdate('[Updater]: Timetables up to date, not updating')
    process.exit(0)
  }
})
