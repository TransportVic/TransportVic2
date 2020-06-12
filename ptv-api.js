const crypto = require('crypto')
const {ptvKey, ptvDevID} = require('./config.json')
const utils = require('./utils')
const TimedCache = require('timed-cache')
const requestCache = new TimedCache({ defaultTtl: 1000 * 30 })

const EventEmitter = require('events')

let ptvAPILocks = {}

function getURL(request) {
  request += (request.includes('?') ? '&' : '?') + 'devid=' + ptvDevID
  let signature = crypto.createHmac('SHA1', ptvKey).update(request).digest('hex').toString('hex')
  return 'https://timetableapi.ptv.vic.gov.au' + request + '&signature=' + signature
}

async function makeRequest(url) {
  try {
    if (ptvAPILocks[url]) {
      return await new Promise((resolve, reject) => {
        ptvAPILocks[url].on('done', data => {
          resolve(data)
        })
        ptvAPILocks[url].on('err', err => {
          reject(err)
        })
      })
    }

    ptvAPILocks[url] = new EventEmitter()

    function returnData(departures) {
      ptvAPILocks[url].emit('done', departures)
      delete ptvAPILocks[url]

      return departures
    }

    let request
    if (request = requestCache.get(url))
      return JSON.parse(request)

    let fullURL = getURL(url)
    let data = await utils.request(fullURL)
    requestCache.put(url, data)

    return returnData(JSON.parse(data))
  } catch (e) {
    ptvAPILocks[url].emit('err', e)
    delete ptvAPILocks[url]

    throw e
  }
}

module.exports = makeRequest
