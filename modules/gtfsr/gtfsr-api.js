const utils = require('../../utils')
const protobuf = require('protocol-buffers')
const fs = require('fs')
const path = require('path')
const GTFSR = protobuf(fs.readFileSync(path.join(__dirname, 'ptv-gtfsr.proto')))
const config = require('../../config')

let { gtfsrKey } = config
let urlBase = 'https://data-exchange-api.vicroads.vic.gov.au/opendata/v1/gtfsr/'

async function makeRequest(url, options={}) {
  let data = await utils.request(urlBase + url, {
    headers: {
      'Ocp-Apim-Subscription-Key': gtfsrKey
    },
    ...options
  })

  return data
}

async function makePBRequest(url) {
  let rawData = await makeRequest(url, {
    raw: true
  })

  return GTFSR.FeedMessage.decode(rawData)
}

module.exports = {
  makeRequest,
  makePBRequest
}
