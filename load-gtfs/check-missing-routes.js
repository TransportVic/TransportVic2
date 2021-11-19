const config = require('../config.json')
const ptvAPI = require('../ptv-api')
const utils = require('../utils')
const routeIDs = require('../additional-data/route-ids')
const postDiscordUpdate = require('../modules/discord-integration')

async function discordUpdate(text) {
  await postDiscordUpdate('routeGTFSID', text)
}

async function main() {
  let ptvRoutes = (await ptvAPI('/v3/routes?route_types=2')).routes
  let missingRoutes = ptvRoutes.filter(route => !routeIDs[route.route_id])

  let message = missingRoutes.map(route => {
    return `Route Number: ${route.route_number || '-'}
Route ID: ${route.route_id}
Route Name: ${route.route_name}`
  }).join('\n-----\n')

  await discordUpdate(message)

  // console.log(JSON.stringify(ptvRoutes.reduce((a,e) => {
  //   a[e.route_id] = e.route_gtfs_id
  //   return a
  // }, routeIDs), null, 2))

  process.exit()
}

main()
