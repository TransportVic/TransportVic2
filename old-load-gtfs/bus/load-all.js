const utils = require('../../utils')
const path = require('path')

function l(p) {
  return path.join(__dirname, p)
}

async function main() {
  await utils.spawnProcess('node', [l('load-type.js'), '4'])
  await utils.spawnProcess('node', [l('extra/load-788-stop-numbers.js')])
  await utils.spawnProcess('node', [l('load-type.js'), '6'])
  // 7, 8 deprecated: 7 replaced by FlexiRide and not in PTV, 8 moved to 4
  await utils.spawnProcess('node', [l('load-type.js'), '11'])

  await utils.spawnProcess('node', [l('../../additional-data/bus-data/geospatial/generate-bus-groupings.js')])
}

if (process.argv[1] && process.argv[1] === __filename) main()
else module.exports = main
