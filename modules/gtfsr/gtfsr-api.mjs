import utils from '../../utils.mjs'
import fs from 'fs/promises'
import path from 'path'
import config from '../../config.json' with { type: 'json' }
import url from 'url'
import Pbf from 'pbf'
import { compile } from 'pbf/compile'
import schema from 'protocol-buffers-schema'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const proto = schema.parse(await fs.readFile(path.join(__dirname, 'ptv-gtfsr.proto')))
const { readFeedMessage } = compile(proto);

let { gtfsrKey } = config
let urlBase = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/'

export async function makeRequest(url, options={}) {
  let data = await utils.request(urlBase + url, {
    headers: {
      'KeyId': gtfsrKey
    },
    ...options
  })

  return data
}

export async function makePBRequest(url) {
  let rawData = await makeRequest(url, {
    raw: true,
    timeout: 12000
  })

  return readFeedMessage(new Pbf(rawData))
}