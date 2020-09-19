const crypto = require('crypto')
const {ptvKeys} = require('./config.json')
const utils = require('./utils')
const TimedCache = require('./TimedCache')

const requestCache = new TimedCache(1000 * 30)

let blankKey = {ptvDevID: "", ptvKey: ""}

function getPTVCreds() {
  if (ptvKeys.length === 0) return blankKey

  let key = ptvKeys[Math.floor(Math.random() * ptvKeys.length)]
  return {
    ptvDevID: key.devID,
    ptvKey: key.key
  }
}

const EventEmitter = require('events')

let ptvAPILocks = {}

function getURL(request) {
  let {ptvDevID, ptvKey} = getPTVCreds()
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

    let request
    if (request = requestCache.get(url))
      return JSON.parse(request)

    ptvAPILocks[url] = new EventEmitter()

    function returnData(departures) {
      ptvAPILocks[url].emit('done', departures)
      delete ptvAPILocks[url]

      return departures
    }

    let fullURL = getURL(url)
    let data = await utils.request(fullURL)
    requestCache.put(url, data)

    return returnData(JSON.parse(data))
  } catch (e) {
    if (ptvAPILocks[url]) {
      ptvAPILocks[url].emit('err', e)
      delete ptvAPILocks[url]
    }

    throw e
  }
}

module.exports = makeRequest
