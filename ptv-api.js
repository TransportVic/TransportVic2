const crypto = require('crypto')
const {ptvKey, ptvDevID} = require('./config.json')
const utils = require('./utils')
const TimedCache = require('timed-cache')
const requestCache = new TimedCache({ defaultTtl: 1000 * 30 })

function getURL(request) {
  request += (request.includes('?') ? '&' : '?') + 'devid=' + ptvDevID
  let signature = crypto.createHmac('SHA1', ptvKey).update(request).digest('hex').toString('hex')
  return 'https://timetableapi.ptv.vic.gov.au' + request + '&signature=' + signature
}

async function makeRequest(url) {
  let request
  if (request = requestCache.get(url))
    return JSON.parse(request)

  let fullURL = getURL(url)
  let data = await utils.request(fullURL)
  requestCache.put(url, data)

  return JSON.parse(data)
}

module.exports = makeRequest
