import { spawn } from 'child_process'
import path from 'path'
import url from 'url'

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

  for (let command of commands) {
    await runNode(command[0], command.slice(1))
  }
}