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
await runNode('load-all-stops-routes.mjs', ['2'])
await runNode('load-all-trips.mjs', ['2'])

await runNode('metro/load-extra-data.mjs')
await runNode('metro/download-metro-timetables.js')
await runNode('metro/load-metro-timetables.js')

await runNode('load-all-post.mjs')

await runNode('metro/load-metro-directions.mjs')
await runNode('extra/load-search-query.js')

await runNode('move-database.mjs')