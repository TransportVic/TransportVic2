import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import busBays from '../../transportvic-data/excel/bus/bays/bus-bays.json' with { type: 'json' }

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

const stops = await database.getCollection('stops')
const stopsWithBays = await stops.findDocuments({
  bays: {
    $elemMatch: {
      mode: 'bus',
      platform: { $exists: true }
    }
  }
}).toArray()

const busBayData = stopsWithBays
  .flatMap(s => s.bays)
  .filter(b => b.mode === 'bus')
  .filter(b => b.platform)

const nonMatching = busBayData.filter(b => {
  const bay = b.platform.slice(4)
  return !busBays[b.stopGTFSID] || busBays[b.stopGTFSID] !== bay
})

const nonMatchingText = nonMatching.map(b => `${b.fullStopName} O: ${b.platform.slice(4)} R: ${busBays[b.stopGTFSID] || '-'}`)

console.log(`Found ${nonMatchingText.length} stops`)
console.log(nonMatchingText.join('\n'))

if (true) console.log(JSON.stringify(nonMatching.map(f => ({
  type: "Feature",
  properties: f,
  geometry: f.location
}))))

process.exit()