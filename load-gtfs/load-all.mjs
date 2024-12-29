import { reject } from 'async'
import { spawn } from 'child_process'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runNode(file) {
  let child = spawn('node', [path.join(__dirname, file)], {
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
await runNode('load-all-post.mjs')