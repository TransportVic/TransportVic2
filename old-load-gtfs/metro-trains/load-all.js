const utils = require('../../utils')
const path = require('path')

function l(p) {
  return path.join(__dirname, p)
}

async function main() {
  await utils.spawnProcess('node', ['--max-old-space-size=2048', l('../split-gtfs/split-gtfs.js'), '2'])

  await utils.spawnProcess('node', [l('load-stops.js')])
  await utils.spawnProcess('node', [l('load-routes.js')])
  await utils.spawnProcess('node', [l('load-gtfs-timetables.js')])

  await utils.spawnProcess('node', [l('extra/load-metro-timetables.js')])
  await utils.spawnProcess('node', [l('extra/load-metro-route-stops.js')])
  await utils.spawnProcess('node', [l('extra/find-guarenteed-connections.js')])

  await utils.spawnProcess('node', [l('generate-route-pathing.js')])
  await utils.spawnProcess('node', [l('fix-destinations.js')])

  await utils.rmDir(l('../spliced-gtfs-stuff/2'))
}

if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
