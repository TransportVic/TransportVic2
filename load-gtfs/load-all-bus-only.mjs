import runCommands from './run-script.mjs'

let start = new Date()
console.log('Starting Bus GTFS loader', start)

let commands = [
  ['create-indexes.mjs'],
  ['load-ptv-stops.mjs'],
  ['load-all-stops-routes.mjs', '4', '6', '11'],
  ['bus/load-788-stop-numbers.mjs'],
  ['load-all-trips.mjs', '4', '6', '11'],

  ['bus/load-flexiride-data.mjs'],

  ['load-all-post.mjs'],

  ['extra/load-search-query.mjs'],
  ['extra/load-route-suburbs.mjs'],
  ['extra/load-opposite-stops.mjs'],

  ['bus/generate-regional-bus-groupings.mjs'],
  ['bus/load-regional-bus-operators.mjs'],

  ['move-database.mjs']
]

await runCommands(commands)

console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')