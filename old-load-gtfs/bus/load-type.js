const utils = require('../../utils')
const path = require('path')

function l(p) {
  return path.join(__dirname, p)
}

async function main() {
  let type = process.argv[2]

  await utils.spawnProcess('node', ['--max-old-space-size=2048', l('../split-gtfs/split-gtfs.js'), type])
  await utils.spawnProcess('node', [l('load-stops.js'), type])
  await utils.spawnProcess('node', [l('load-routes.js'), type])
  await utils.spawnProcess('node', [l('load-gtfs-timetables.js'), type])

  await utils.rmDir(l('../spliced-gtfs-stuff/' + type))
}

if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
