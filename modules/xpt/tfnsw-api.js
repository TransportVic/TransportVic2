const utils = require('../../utils.mjs')
const protobuf = require('protocol-buffers')
const fs = require('fs')
const path = require('path')
const GTFSR = protobuf(fs.readFileSync(path.join(__dirname, 'gtfsr.proto')))
const config = require('../../config')

let {tfnswAPIKey} = config
let urlBase = 'https://api.transport.nsw.gov.au'

async function makeRequest(url, options={}) {
  let data = await utils.request(urlBase + url, {
    headers: {
      Authorization: 'apikey ' + tfnswAPIKey
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
