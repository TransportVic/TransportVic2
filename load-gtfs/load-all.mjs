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
  ['load-all-trips.mjs'],

  ['bus/load-flexiride-data.mjs'],

  ['metro/load-extra-data.mjs'],
  ['metro/download-metro-timetables.mjs'],
  ['metro/load-metro-timetables.mjs'],

  ['load-all-post.mjs'],

  ['tram/load-tramtracker-ids.mjs'],

  ['extra/load-search-query.mjs'],
  ['extra/load-route-suburbs.mjs'], // TODO: Move to network regions
  ['extra/load-opposite-stops.mjs'],

  ['bus/generate-regional-bus-groupings.mjs'],
  ['bus/load-regional-bus-operators.mjs'],

  ['move-database.mjs']
]

await runCommands(commands)

console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')