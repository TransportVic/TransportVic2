const {spawn} = require('child_process')
const path = require('path')

const modules = require('../modules')

function l(p) {
  return path.join(__dirname, p)
}

function spawnProcess(path, args, finish) {
  return new Promise(resolve => {
    let childProcess = spawn(path, args)

    childProcess.stdout.on('data', data => {
      process.stdout.write(data.toString())
    })

    childProcess.stderr.on('data', data => {
      process.stderr.write(data.toString())
    })

    childProcess.on('close', code => {
      resolve()
    })
  })
}

function moduleEnabled(name) {
  return modules.Next4 && modules.Next4[name]
}

async function main() {
  await spawnProcess('node', [l('create-indexes.js')])
  if (moduleEnabled('metro')) await spawnProcess(l('metro-trains/load-all.sh'))
  if (moduleEnabled('vline')) await spawnProcess(l('vline-trains/load-all.sh'))
  if (moduleEnabled('coach')) await spawnProcess(l('regional-coach/load-all.sh'))
  if (moduleEnabled('bus')) await spawnProcess(l('bus/load-all.sh'))
  if (moduleEnabled('tram')) await spawnProcess(l('trams/load-all.sh'))
  if (moduleEnabled('ferry')) await spawnProcess(l('ferry/load-all.sh'))
  if (moduleEnabled('bus')) await spawnProcess(l('monash-shuttle/load-all.sh'))
  if (moduleEnabled('heritage')) await spawnProcess(l('heritage-trains/load-all.sh'))

  await spawnProcess('node', [l('load-route-stops.js')])
  if (moduleEnabled('bus')) await spawnProcess('node', [l('load-route-stops.js')])
  await spawnProcess('node', [l('load-stop-services.js')])

  await spawnProcess('node', [l('load-route-suburbs.js')])
}

main()
