const request = require('request')
const fs = require('fs')
const {spawn} = require('child_process')
const DatabaseConnection = require('../database/DatabaseConnection')
const ws = require('ws')

const config = require('../config.json')

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


let lastEtag
try {
  lastEtag = fs.readFileSync(__dirname + '/last-etag').toString()
} catch (e) {
  console.log('No etag, downloading data')
}

function spawnProcess(path, finish) {
  let childProcess = spawn(path)

  function processLines(data) {
    let lines = data.split('\n').map(e => e.trim()).filter(Boolean)
    lines.forEach(line => {
      if (line.match(/\d+ms http/)) return
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
    console.log(`finished with code ${code}`)

    broadcast({
      type: 'complete'
    })

    finish()
  })
}

async function updateTimetables() {
  let database = new DatabaseConnection(config.databaseURL, config.databaseName)
  return new Promise(resolve => {
    database.connect(async err => {
      let stops = database.getCollection('stops')
      let routes = database.getCollection('routes')
      let gtfsTimetables = database.getCollection('gtfs timetables')
      try {
        await stops.dropCollection()
        await routes.dropCollection()
        await gtfsTimetables.dropCollection()
      } catch (e) {
      }

      console.log('Dropped stops, routes and gtfs timetables')
      spawnProcess(__dirname + '/../load-gtfs/load-all.sh', () => {
        console.log('Done!')
        process.exit()
      })
    })
  })
}

console.log('Checking for updates...')
updateTimetables()
// request.head('http://data.ptv.vic.gov.au/downloads/gtfs.zip', async (err, resp, body) => {
//   let {etag} = resp.headers
//   if (etag !== lastEtag) {
//     console.log('Outdated timetables: updating now...')
//     spawnProcess(__dirname + '/../update-gtfs.sh', async () => {
//       fs.writeFileSync(__dirname + '/last-etag', etag)
//       await updateTimetables()
//     })
//   } else {
//     console.log('Timetables all good, exiting')
//     process.exit()
//   }
// })
