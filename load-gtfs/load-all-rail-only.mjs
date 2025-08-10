import runCommands from './run-script.mjs'

let start = new Date()
console.log('Starting Rail GTFS loader', start)

let commands = [
  ['create-indexes.mjs'],
  ['load-ptv-stops.mjs'],
  ['load-all-stops-routes.mjs', '1', '2', '10'],

  ['vline/api-integration/load-vnet-station-names.mjs'],
  ['vline/timetables/download-vline-timetables.mjs'],
  ['vline/timetables/load-vline-timetables.mjs'],

  ['load-all-trips.mjs', '1', '2', '10'],

  ['metro/load-extra-data.mjs'],
  ['metro/download-metro-timetables.mjs'],
  ['metro/load-metro-timetables.mjs'],

  ['load-all-post.mjs'],

  ['extra/load-search-query.mjs'],

  ['move-database.mjs']
]

await runCommands(commands)

console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')