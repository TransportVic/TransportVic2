import { spawn } from 'child_process'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runNode(file, args = []) {
  let child = spawn('node', [path.join(__dirname, file), ...args], {
    cwd: __dirname
  })

  let promise = new Promise(resolve => child.on('close', resolve))

  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)

  return promise
}

await runNode('create-indexes.mjs')
await runNode('load-all-stops-routes.mjs')
await runNode('load-all-trips.mjs')

await runNode('metro/load-extra-data.mjs')
await runNode('metro/download-metro-timetables.js')
await runNode('metro/load-metro-timetables.js')


await runNode('bus/load-788-stop-numbers.js')

await runNode('vline/api-integration/load-vnet-station-names.js')
await runNode('vline/timetables/download-vline-timetables.js')
// await runNode('vline/timetables/load-vline-timetables.js')

await runNode('load-all-post.mjs')

await runNode('tram/load-stops.js')
await runNode('tram/load-tramtracker-ids.js')

await runNode('extra/load-route-suburbs.js')
await runNode('extra/load-search-query.js')

await runNode('../additional-data/bus-data/geospatial/generate-bus-groupings.js')
await runNode('bus/load-regional-bus-operators.js')