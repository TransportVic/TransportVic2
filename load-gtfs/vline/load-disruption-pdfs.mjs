import path from 'path'
import scripts from '../../transportvic-data/rail-pdfs/scripts.mjs'
import { spawn } from 'child_process'

const file = path.join(import.meta.dirname, '../..', 'scripts', 'load-vline-tt.mjs')

for (const command of scripts.commands) {
  await new Promise(resolve => {
    console.log('node', [ file, ...command ].join(' '))

    const childProcess = spawn('node', [ file, ...command ], {
      cwd: scripts.cwd
    })

    childProcess.stdout.pipe(process.stdout)
    childProcess.stderr.pipe(process.stderr)

    childProcess.on('close', code => {
      console.log('Finished with code', code)
      resolve()
    })
  })
}