import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, VLineAPIInterface } from '@transportme/ptv-api'

let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()
let stops = database.getCollection('gtfs-stops')

let ptvAPI = new PTVAPI()
let vlineAPIInterface = new VLineAPIInterface(
  config.vlineCallerID,
  config.vlineSignature
)
ptvAPI.addVLine(vlineAPIInterface)

const coachOverrides = [
  'Nhill: Station',
  'Dimboola Station',
  'Stawell Station',
  'Horsham Station',
  'Werribee Station'
]

let locations = await ptvAPI.vline.getAllLocations()

let fixedLocations = {}
for (let location of locations) {
  if (coachOverrides.includes(location.name)) location.type = 'Station'
  if (location.stopType !== 'Station') continue

  let stationName = location.name.replace(/^Melbourne[^\w]+/, '').replace(/\(.+\)/g, '')
    .replace(/: .+/, '').replace(/Station.*/, '').replace(/Railway.*/, '')
    .replace(/  +/, ' ').trim() + ' Railway Station'
  location.stationName = stationName

  if (!fixedLocations[stationName]) {
    fixedLocations[stationName] = location
  } else if (fixedLocations[stationName].position && !location.position) continue
  else if (fixedLocations[stationName].name.length > location.name.length) {
    fixedLocations[stationName] = location
  }
}

let updated = 0
for (let location of Object.values(fixedLocations)) {
  let stationName = location.stationName

  let stopData = await stops.findDocument({ stopName: stationName })
  if (!stopData) {
    console.log(`Load VNet Names: Skipping ${location.name} - no matching stop`)
    continue
  }

  let vlinePlatform = stopData.bays.find(bay => bay.mode === 'regional train' && bay.stopType === 'station')
  if (!vlinePlatform) {
    console.log(`Load VNet Names: Skipping ${location.name} - no matching bay`)
    continue
  }

  vlinePlatform.vnetStationName = location.name
  updated++

  await stops.updateDocument({ _id: stopData._id }, {
    $set: stopData
  })
}

console.log('Completed updating ' + updated + ' V/Line stop VNET names')
process.exit()