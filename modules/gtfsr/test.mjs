import { makePBRequest } from './gtfsr-api.mjs'
import utils from '../../utils.mjs'
import url from 'url'
import path from 'path'
import fs from 'fs/promises'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let dataset = process.argv[2]
if (!dataset) {
  console.log('Error: needs dataset')
  process.exit(1)
}
try {
  const { rawData, message } = await makePBRequest(dataset, true)
  utils.inspect(message)
} catch (e) {
  console.log(e)
  console.log(e.response.toString())
}