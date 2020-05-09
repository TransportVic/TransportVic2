const request = require('request')
const fs = require('fs')
const {spawn} = require('child_process')
const DatabaseConnection = require('../database/DatabaseConnection')

const config = require('../config.json')

let lastEtag
try {
  lastEtag = fs.readFileSync(__dirname + '/last-etag').toString()
} catch (e) {
  console.log('No etag, downloading data')
}

function spawnProcess(path, finish) {
  let childProcess = spawn(path)

  childProcess.stdout.on('data', data => {
    process.stdout.write(data.toString())
  })
  childProcess.stderr.on('data', data => {
    process.stderr.write(data.toString())
  })
  childProcess.on('close', code => {
    console.log(`finished with code ${code}`)
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
request.head('http://data.ptv.vic.gov.au/downloads/gtfs.zip', async (err, resp, body) => {
  let {etag} = resp.headers
  if (etag !== lastEtag) {
    console.log('Outdated timetables: updating now...')
    spawnProcess(__dirname + '/../update-gtfs.sh', async () => {
      fs.writeFileSync(__dirname + '/last-etag', etag)
      await updateTimetables()
    })
  } else {
    console.log('Timetables all good, exiting')
    process.exit()
  }
})
