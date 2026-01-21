import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import destos from '../../additional-data/bus-destinations.json' with { type: 'json' }
import utils from '../../utils.mjs'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

const gtfsTimetables = await database.getCollection('gtfs timetables')
const destinations = await gtfsTimetables.aggregate([{
  $match: {
    mode: 'bus'
  }
}, {
  $group: {
    _id: { routeNumber: '$routeNumber', destination: '$destination' }
  }
}, {
  $project: {
    _id: 0,
    routeNumber: '$_id.routeNumber',
    destination: '$_id.destination'
  }
}]).sort({ routeNumber: 1, destination: 1 }).toArray()

const missing = destinations.map(({ routeNumber, destination }) => {
  destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')
  let shortName = utils.getStopName(destination)
  
  if (utils.isStreet(shortName)) return { routeNumber, destination }
  return { routeNumber, destination: shortName }
}).filter(({ routeNumber, destination }) => {
  const routeData = destos.service[routeNumber] || {}
  return !routeData[destination] && !destos.generic[destination] && !(destination.includes('Station') || destination.includes('SC') || destination.includes('University') || destination.includes('Interchange') || destination.includes('Town Centre') || destination.includes('Terminus') || destination.includes('College') || destination.includes('Secondary') || destination.includes('Primary'))
})

utils.inspect(missing)

process.exit()