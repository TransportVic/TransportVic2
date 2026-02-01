import runCommands from './run-script.mjs'

let start = new Date()
console.log('Starting full GTFS loader', start)

let mainCommands = [
  ['create-indexes.mjs'],
  ['load-ptv-stops.mjs'],
  ['load-all-stops-routes.mjs'],

  ['vline/load-extra-data.mjs'],
  ['metro/load-extra-data.mjs'],
  ['tram/load-extra-data.mjs'],

  ['vline/api-integration/load-vnet-station-names.mjs'],
  ['vline/timetables/download-vline-timetables.mjs'],
  ['vline/timetables/load-vline-timetables.mjs'],
  ['vline/timetables/download-heat-timetables.mjs'],
  ['vline/timetables/load-heat-timetables.mjs'],

  ['bus/load-788-stop-numbers.mjs'],
  ['bus/mildura/load-mildura-routes.mjs'],

  ['load-all-trips.mjs'],

  ['restart-database.mjs'],

  ['bus/load-flexiride-data.mjs'],
  ['bus/mildura/cleanup-mildura-routes.mjs'],

  ['bus/patch-eastern-trips.mjs'],

  ['metro/download-metro-timetables.mjs'],
  ['metro/load-metro-timetables.mjs'],

  ['load-all-post.mjs'],

  ['restart-database.mjs'],

  ['tram/load-tramtracker-ids.mjs'],

  ['extra/load-search-query.mjs'],
  ['extra/load-route-suburbs.mjs'], // TODO: Move to network regions
  ['extra/load-opposite-stops.mjs'],

  ['bus/generate-regional-bus-groupings.mjs'],
  ['bus/load-regional-bus-operators.mjs'],
  ['restart-database.mjs']
]

const moveDatabase = [['move-database.mjs']]

await runCommands(mainCommands)
const returnCode = await runCommands(moveDatabase)
await runCommands([['metro-rail-bus/load.mjs']])
await runCommands([['vline/load-disruption-pdfs.mjs']])

console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')
process.exit(returnCode)