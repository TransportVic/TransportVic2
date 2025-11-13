import runCommands from './run-script.mjs'

let start = new Date()
console.log('Starting full GTFS loader', start)

let commands = [
  ['create-indexes.mjs'],
  ['load-ptv-stops.mjs'],
  ['load-all-stops-routes.mjs'],

  ['vline/api-integration/load-vnet-station-names.mjs'],
  ['vline/timetables/download-vline-timetables.mjs'],
  ['vline/timetables/load-vline-timetables.mjs'],

  ['bus/load-788-stop-numbers.mjs'],
  ['/bus/mildura/load-mildura-routes.mjs'],

  ['tram/load-extra-data.mjs'],

  ['load-all-trips.mjs'],
  
  ['restart-database.mjs'],

  ['bus/load-flexiride-data.mjs'],
  ['bus/mildura/cleanup-mildura-routes.mjs'],

  ['metro/load-extra-data.mjs'],
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

  ['move-database.mjs']
]

let returnCode = await runCommands(commands)
console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')
process.exit(returnCode)