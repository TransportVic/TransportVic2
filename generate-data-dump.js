const config = require('./config.json')
const DatabaseConnection = require('./database/DatabaseConnection')
const utils = require('./utils')
const async = require('async')
const fs = require('fs')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let outputStream = fs.createWriteStream('./bus_trips.csv')

async function write(data) {
  if (!outputStream.write(data)) {
    await new Promise(r => outputStream.once('drain', r))
  }
}

async function dumpTrips(trips) {
  for (trip of trips) {
    let line = `${trip.date},${trip.routeGTFSID},${trip.origin},${trip.destination},${trip.departureTime},${trip.destinationArrivalTime},${trip.smartrakID},${trip.routeNumber}\n`
    await write(line)
  }
}

database.connect(async () => {
  let busTrips = database.getCollection('bus trips')
  let tripCount = await busTrips.countDocuments()

  await write('date,route_gtfs_id,origin,destination,departure_time,destination_arrival_time,bus_id,route_number')

  let iterationSize = 1000
  let iterationCount = Math.ceil(tripCount / iterationSize)
  let sets = [...Array(iterationCount).keys()].map(e => e * iterationSize)
  await async.forEach(sets, async skip => {
    let trips = await busTrips.findDocuments().skip(skip).limit(iterationSize).toArray()
    await dumpTrips(trips)
  })

  await new Promise(r => outputStream.end('', r))
  console.log('Done, dumped ' + tripCount + ' trips')
  process.exit()
})
