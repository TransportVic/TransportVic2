const utils = require('../../utils')
const path = require('path')

function l(p) {
  return path.join(__dirname, p)
}

async function main() {
  await utils.spawnProcess('node', [l('load-stops.js')])
  await utils.spawnProcess('node', [l('load-routes.js')])
  await utils.spawnProcess('node', [l('load-timetables.js')])

  await utils.spawnProcess('node', [l('mainline/load-data.js')])
}

if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
