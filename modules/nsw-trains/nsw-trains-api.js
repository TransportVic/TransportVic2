const utils = require('../../utils')
const protobuf = require('protocol-buffers')
const fs = require('fs')
const GTFSR = protobuf(fs.readFileSync('gtfsr.proto'))
const config = require('../../config')

let {tfnswAPIKey} = config
let urlBase = 'https://api.transport.nsw.gov.au'

async function makeRequest(url, options={}) {
  let data = await utils.request({
    url: urlBase + url,
    method: 'GET',
    headers: {
      Authorization: 'apikey ' + tfnswAPIKey
    },
    ...options
  })

  return data
}

async function makePBRequest(url) {
  let rawData = await makeRequest(url, {
    encoding: null
  })

  return GTFSR.FeedMessage.decode(rawData)
}

module.exports = {
  makeRequest,
  makePBRequest
}
