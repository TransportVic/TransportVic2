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

let start = new Date()
console.log('Starting full GTFS loader', start)

await runNode('create-indexes.mjs')
await runNode('load-all-stops-routes.mjs', ['4', '6', '11'])
await runNode('bus/load-788-stop-numbers.mjs')
await runNode('load-all-trips.mjs', ['4', '6', '11'])

await runNode('bus/load-flexiride-data.mjs')

await runNode('load-all-post.mjs')

await runNode('extra/load-search-query.mjs')
await runNode('extra/load-route-suburbs.mjs')
await runNode('extra/load-opposite-stops.mjs')

await runNode('bus/generate-regional-bus-groupings.mjs')
await runNode('bus/load-regional-bus-operators.mjs')

await runNode('move-database.mjs')

console.log('\nLoading GTFS took', (new Date() - start) / 1000 / 60, 'minutes overall')