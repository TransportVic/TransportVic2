import { spawn } from 'child_process'
import path from 'path'
import url from 'url'
import async from 'async'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async function runCommands(commands) {
  function runNode(file, args = []) {
    let child = spawn('node', ['--max-old-space-size=3328', path.join(__dirname, file), ...args], {
      cwd: __dirname
    })

    let promise = new Promise(resolve => child.on('close', resolve))

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

    return promise
  }

  return await async.reduce(commands, 0, async (prev, command) => {
    const exitCode = await runNode(command[0], command.slice(1))
    if (exitCode !== 0) console.warn(`WARN: ${command} exited uncleanly with exit code ${exitCode}`)
    return Math.max(prev, exitCode)
  })
}