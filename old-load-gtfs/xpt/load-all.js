const utils = require('../../utils.mjs')
const path = require('path')

function l(p) {
  return path.join(__dirname, p)
}

async function main() {
  await utils.spawnProcess('node', [l('download-gtfs.js')])

  await utils.spawnProcess('node', [l('load-stops.js')])
  await utils.spawnProcess('node', [l('load-routes.js')])
  await utils.spawnProcess('node', [l('load-gtfs-timetables.js')])
}

if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
