import { makePBRequest } from './gtfsr-api.mjs'
import utils from '../../utils.mjs'

let dataset = process.argv[2]
if (!dataset) {
  console.log('Error: needs dataset')
  process.exit(1)
}
try {
  let vehicleData = await makePBRequest(dataset)
  utils.inspect(vehicleData)
} catch (e) {
  console.log(e)
  console.log(e.response.toString())
}