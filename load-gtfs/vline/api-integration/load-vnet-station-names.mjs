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

let updated = 0
for (let location of locations) {
  if (coachOverrides.includes(location.name)) location.type = 'Station'
  if (location.stopType !== 'Station') continue

  let stationName = location.name.replace(/^Melbourne[^\w]+/, '').replace(/\(.+\)/g, '')
    .replace(/: .+/, '').replace(/Station.*/, '').replace(/Railway.*/, '')
    .replace(/  +/, ' ').trim() + ' Railway Station'

  let stopData = await stops.findDocument({ stopName: stationName })
  if (!stopData) {
    console.log(`Load VNet Names: Skipping ${location.name}`)
    continue
  }

  let vlinePlatform = stopData.bays.find(bay => bay.mode === 'regional train' && !bay.parentStopGTFSID)
  if (!vlinePlatform) {
    console.log(`Load VNet Names: Skipping ${location.name}`)
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