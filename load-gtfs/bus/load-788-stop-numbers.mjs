import async from 'async'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import stopNumbers from '../../transportvic-data/bus/misc/788-stop-numbers.mjs'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

let stops = database.getCollection('gtfs-stops')

await async.forEachLimit(Object.keys(stopNumbers), 20, async stopGTFSID => {
  let stopData = await stops.findDocument({ 'bays.stopGTFSID': stopGTFSID })
  if (!stopData) return console.warn('Could not set stop number for', stopGTFSID, '#' + stopNumbers[stopGTFSID])
  let bay = stopData.bays.find(bay => bay.mode === 'bus' && bay.stopGTFSID === stopGTFSID)
  bay.stopNumber = stopNumbers[stopGTFSID]

  await stops.replaceDocument({
    _id: stopData._id
  }, stopData)
})

let stopCount = Object.keys(stopNumbers).length

console.log('Completed updating ' + stopCount + ' bus stop numbers for 788')
process.exit()