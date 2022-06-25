const utils = require('../../utils')
const path = require('path')

function l(p) {
  return path.join(__dirname, p)
}

async function main() {
  await utils.spawnProcess('node', ['--max-old-space-size=2048', l('../split-gtfs/split-gtfs.js'), '1'])

  await utils.spawnProcess('node', [l('load-stops.js')])
  await utils.spawnProcess('node', [l('load-routes.js')])
  await utils.spawnProcess('node', [l('load-gtfs-timetables.js')])

  await utils.spawnProcess('node', [l('extra/load-vline-timetables.js')])
  await utils.spawnProcess('node', [l('extra/load-vline-zones.js')])
  await utils.spawnProcess('node', [l('api-integration/load-vnet-station-names.js')])

  await utils.rmDir(l('../spliced-gtfs-stuff/1'))
}

if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
