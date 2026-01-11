import runCommands from './run-script.mjs'

let start = new Date()
console.log('Starting Rail GTFS loader', start)

let commands = [
  ['create-indexes.mjs'],
  ['load-ptv-stops.mjs'],
  ['load-all-stops-routes.mjs', '1', '2', '5', '10'],

  ['vline/load-extra-data.mjs'],
  ['metro/load-extra-data.mjs'],

  ['vline/api-integration/load-vnet-station-names.mjs'],
  ['vline/timetables/download-vline-timetables.mjs'],
  ['vline/timetables/load-vline-timetables.mjs'],
  ['vline/timetables/download-heat-timetables.mjs'],
  ['vline/timetables/load-heat-timetables.mjs'],

  ['load-all-trips.mjs', '1', '2', '5', '10'],

  ['metro/download-metro-timetables.mjs'],
  ['metro/load-metro-timetables.mjs'],

  ['load-all-post.mjs'],

  ['extra/load-search-query.mjs'],

  ['move-database.mjs'],

  ['vline/load-disruption-pdfs.mjs']
]

let returnCode = await runCommands(commands)
console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')
process.exit(returnCode)