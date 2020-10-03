const {spawn} = require('child_process')
const path = require('path')

const modules = require('../modules')
const utils = require('../utils')
const postDiscordUpdate = require('../modules/discord-integration')

async function discordUpdate(text) {
  await postDiscordUpdate('timetables', text)
}

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
  await discordUpdate('[Updater]: Created indexes')

  if (moduleEnabled('metro')) {
    await discordUpdate('[Updater]: Loading Metro data')
    await spawnProcess(l('metro-trains/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Metro data')
  } else await discordUpdate('[Updater]: Skipping Metro')

  if (moduleEnabled('vline')) {
    await discordUpdate('[Updater]: Loading V/Line data')
    await spawnProcess(l('vline-trains/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading V/Line data')
  } else await discordUpdate('[Updater]: Skipping V/Line')

  if (moduleEnabled('xpt')) {
    await discordUpdate('[Updater]: Loading XPT data')
    await spawnProcess(l('xpt/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading XPT data')
  } else await discordUpdate('[Updater]: Skipping XPT')

  if (moduleEnabled('coach')) {
    await discordUpdate('[Updater]: Loading Coach data')
    await spawnProcess(l('regional-coach/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Coach data')
  } else await discordUpdate('[Updater]: Skipping Coach')

  if (moduleEnabled('bus')) {
    await discordUpdate('[Updater]: Loading Bus data')
    await spawnProcess(l('bus/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Bus data')
  } else await discordUpdate('[Updater]: Skipping Bus')

  if (moduleEnabled('tram')) {
    await discordUpdate('[Updater]: Loading Tram data')
    await spawnProcess(l('trams/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Tram data')
  } else await discordUpdate('[Updater]: Skipping Tram')

  if (moduleEnabled('ferry')) {
    await discordUpdate('[Updater]: Loading Ferry data')
    await spawnProcess(l('ferry/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Ferry data')
  } else await discordUpdate('[Updater]: Skipping Ferry')

  if (moduleEnabled('bus')) {
    await discordUpdate('[Updater]: Loading Shuttle Bus data')
    await spawnProcess(l('shuttles/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Shuttle Bus data')
  } else await discordUpdate('[Updater]: Skipping Shuttle Bus')

  if (moduleEnabled('heritage')) {
    await discordUpdate('[Updater]: Loading Heritage Train data')
    await spawnProcess(l('heritage-trains/load-all.sh'))
    await discordUpdate('[Updater]: Finished loading Heritage Train data')
  } else await discordUpdate('[Updater]: Skipping Heritage Train')


  await spawnProcess('node', [l('load-route-stops.js')])
  await discordUpdate('[Updater]: Loaded route stops')

  if (moduleEnabled('bus')) {
    await spawnProcess('node', [l('load-bus-route-names.js')])
    await discordUpdate('[Updater]: Loaded bus route names')
  }

  await spawnProcess('node', [l('load-stop-services.js')])
  await discordUpdate('[Updater]: Loaded stop services')

  await spawnProcess('node', [l('load-route-suburbs.js')])
  await discordUpdate('[Updater]: Loaded route suburbs')
}

main()
