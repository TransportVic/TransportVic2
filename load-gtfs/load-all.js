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

function moduleEnabled(name) {
  return modules.Next4 && modules.Next4[name]
}

async function main() {
  await utils.spawnProcess('node', [l('create-indexes.js')])
  await discordUpdate('[Updater]: Created indexes')

  if (moduleEnabled('metro')) {
    await discordUpdate('[Updater]: Loading Metro data')
    await require('./metro-trains/load-all')()
    await discordUpdate('[Updater]: Finished loading Metro data')
  } else await discordUpdate('[Updater]: Skipping Metro')

  if (moduleEnabled('vline')) {
    await discordUpdate('[Updater]: Loading V/Line data')
    await require('./vline-trains/load-all')()
    await discordUpdate('[Updater]: Finished loading V/Line data')
  } else await discordUpdate('[Updater]: Skipping V/Line')

  if (moduleEnabled('vline')) {
    await discordUpdate('[Updater]: Loading Overland data')
    await require('./overland/load-all')()
    await discordUpdate('[Updater]: Finished loading Overland data')
  } else await discordUpdate('[Updater]: Skipping Overland')

  if (moduleEnabled('xpt')) {
    await discordUpdate('[Updater]: Loading XPT data')
    await require('./xpt/load-all')()
    await discordUpdate('[Updater]: Finished loading XPT data')
  } else await discordUpdate('[Updater]: Skipping XPT')

  if (moduleEnabled('coach')) {
    await discordUpdate('[Updater]: Loading Coach data')
    await require('./regional-coach/load-all')()
    await discordUpdate('[Updater]: Finished loading Coach data')
  } else await discordUpdate('[Updater]: Skipping Coach')

  if (moduleEnabled('bus')) {
    await discordUpdate('[Updater]: Loading Bus data')
    await require('./bus/load-all')()
    await discordUpdate('[Updater]: Finished loading Bus data')
  } else await discordUpdate('[Updater]: Skipping Bus')

  if (moduleEnabled('tram')) {
    await discordUpdate('[Updater]: Loading Tram data')
    await require('./trams/load-all')()
    await discordUpdate('[Updater]: Finished loading Tram data')
  } else await discordUpdate('[Updater]: Skipping Tram')

  if (moduleEnabled('ferry')) {
    await discordUpdate('[Updater]: Loading Ferry data')
    await require('./ferry/load-all')()
    await discordUpdate('[Updater]: Finished loading Ferry data')
  } else await discordUpdate('[Updater]: Skipping Ferry')

  if (moduleEnabled('bus')) {
    await discordUpdate('[Updater]: Loading Shuttle Bus data')
    await require('./shuttles/load-all')()
    await discordUpdate('[Updater]: Finished loading Shuttle Bus data')
  } else await discordUpdate('[Updater]: Skipping Shuttle Bus')
/*
  if (moduleEnabled('heritage')) {
    await discordUpdate('[Updater]: Loading Heritage Train data')
    await require('./heritage-trains/load-all')()
    await discordUpdate('[Updater]: Finished loading Heritage Train data')
  } else await discordUpdate('[Updater]: Skipping Heritage Train')
*/

  await utils.spawnProcess('node', [l('load-route-stops.js')])
  await discordUpdate('[Updater]: Loaded route stops')

  if (moduleEnabled('bus')) {
    await utils.spawnProcess('node', [l('load-bus-route-names.js')])
    await discordUpdate('[Updater]: Loaded bus route names')
  }

  await utils.spawnProcess('node', [l('load-stop-services.js')])
  await discordUpdate('[Updater]: Loaded stop services')

  await utils.spawnProcess('node', [l('load-route-suburbs.js')])
  await discordUpdate('[Updater]: Loaded route suburbs')

  await utils.spawnProcess('node', [l('load-search-query.js')])
  await discordUpdate('[Updater]: Loaded Search Query')
}

// If appears to be run as a script, run, otherwise expose as a module
if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
