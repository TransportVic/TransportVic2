import { spawn } from 'child_process'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runNode(file, args = []) {
  let child = spawn('node', ['--max-old-space-size=4096', path.join(__dirname, file), ...args], {
    cwd: __dirname
  })

  let promise = new Promise(resolve => child.on('close', resolve))

  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)

  return promise
}

let start = new Date()
console.log('Starting full GTFS loader', start)

await runNode('create-indexes.mjs')
await runNode('load-all-stops-routes.mjs')
await runNode('bus/load-788-stop-numbers.js')
await runNode('load-all-trips.mjs')

await runNode('bus/load-flexiride-data.mjs')

await runNode('metro/load-extra-data.mjs')
await runNode('metro/download-metro-timetables.js')
await runNode('metro/load-metro-timetables.js')

await runNode('vline/api-integration/load-vnet-station-names.mjs')
await runNode('vline/timetables/download-vline-timetables.mjs')
await runNode('vline/timetables/load-vline-timetables.mjs')

await runNode('load-all-post.mjs')

await runNode('tram/load-stops.mjs')
await runNode('tram/load-tramtracker-ids.mjs')

await runNode('extra/load-search-query.mjs')
await runNode('extra/load-route-suburbs.mjs') // TODO: Move to network regions

await runNode('bus/generate-regional-bus-groupings.mjs')
await runNode('bus/load-regional-bus-operators.js')

await runNode('move-database.mjs')

await runNode('health-check/check.mjs')

console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')