const async = require('async')
const config = require('../../config')
const { makePBRequest } = require('./gtfsr-api')

async function main() {
  let dataset = process.argv[2]
  if (!dataset) return console.log('Error: needs dataset')

  let vehicleData = await makePBRequest(dataset)
  console.log(require('util').inspect(vehicleData, { maxArrayLength: null, depth: null }))
}

main()
