const ptvAPI = require('../../ptv-api.mjs')
const fs = require('fs/promises')
const discord = require('../discord-integration.mjs')
const utils = require('../../utils.mjs')
let stops = {}

let RWD = {
  stop_suburb: "Ringwood",
  stop_name: "Ringwood Railway Station/Maroondah Hwy",
  stop_latitude: -37.815080163896,
  stop_longitude: 145.22988517169
}

let MONASH = {
  stop_suburb: "Clayton",
  stop_name: "Monash University",
  stop_latitude: -37.9136868109722,
  stop_longitude: 145.131768418562
}

let CSA = {
  stop_suburb: "Chelsea",
  stop_name: "Chelsea Railway Station/Station St",
  stop_latitude: -38.0533202689789,
  stop_longitude: 145.116861077446
}

let TNT = {
  stop_suburb: "Tarneit",
  stop_name: "Tarneit Railway Station",
  stop_latitude: -37.8326687887396,
  stop_longitude: 144.694971480843
}

let HLM = {
  stop_suburb: 'Hallam',
  stop_name: 'Hallam Railway Station/Hallam South Rd',
  stop_latitude: -38.01721,
  stop_longitude: 145.271164
}

let MELB = {
  stop_suburb: 'Carlton',
  stop_name: 'Melbourne University/Grattan St',
  stop_latitude: -37.8001251,
  stop_longitude: 144.9619
}

let DONC = {
  stop_suburb: 'Doncaster',
  stop_name: 'Doncaster Shopping Centre',
  stop_latitude: -37.784023479792,
  stop_longitude: 145.124988971071
}

let GLO_SHOW = {
  stop_suburb: 'Thomson: 3219',
  stop_name: 'Geelong Showgrounds/St. Albans Road',
  stop_latitude: -38.1705248914605,
  stop_longitude: 144.377048460666
}

let ELT = {
  stop_suburb: 'Eltham',
  stop_name: 'Eltham Railway Station',
  stop_latitude: -37.7135496724667 ,
  stop_longitude: 145.147822019567
}

let LAV = {
  stop_suburb: 'Laverton',
  stop_name: 'Laverton Railway Station',
  stop_latitude: -37.86431665,
  stop_longitude: 144.77075650
}

let NWA = {
  stop_suburb: 'Narre Warren',
  stop_name: 'Narre Warren South College',
  stop_latitude: -38.05024062,
  stop_longitude: 145.28538849
}

let allStops = [
  RWD, MONASH, CSA, TNT, HLM, MELB, DONC, GLO_SHOW, ELT, LAV, NWA
]

let failedStops = []

async function check(stopID) {
  let data = await ptvAPI(`/v3/departures/route_type/2/stop/${stopID}?max_results=2&expand=Stop`)
  let stopData = data.stops[stopID]
  if (!stopData) return
  if (stopData.stop_latitude !== 0) return

  let stopName = utils.expandStopName(utils.adjustStopName(stopData.stop_name || stopData.stop_landmark))
  let matchingData = allStops.find(stop => stop.stop_name.includes(stopName))
  if (!matchingData) {
    console.log(stopData)
    if (!failedStops.includes(stopName)) failedStops.push(stopName)
    return
  }

  stops[stopID] = {
    ...matchingData,
    route_type: 2,
    stop_id: stopID
  }
}

async function main() {
  for (let stopID = 18555; stopID <= 18559; stopID++) await check(stopID)
  for (let stopID = 32140; stopID <= 32160; stopID++) await check(stopID)
  
  await fs.writeFile(__dirname + '/override-stops.json', JSON.stringify(stops, null, 2))
  if (failedStops.length) await updateDiscord()
  process.exit(0)
}

async function updateDiscord() {
  let message = `DIVA Stops Merge Failure:\n${failedStops.join('\n')}`
  await discord('routeGTFSID', message)
}

main()

module.exports = stops