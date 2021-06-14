const crypto = require('crypto')
const { ptvKeys } = require('./config.json')
const utils = require('./utils')
const cheerio = require('cheerio')

let blankKey = {ptvDevID: "", ptvKey: ""}

let past50ResponseTimes = []

function getPTVCreds() {
  if (ptvKeys.length === 0) return blankKey

  let key = ptvKeys[Math.floor(Math.random() * ptvKeys.length)]
  return {
    ptvDevID: key.devID,
    ptvKey: key.key
  }
}

function getURL(request) {
  let {ptvDevID, ptvKey} = getPTVCreds()
  request += (request.includes('?') ? '&' : '?') + 'devid=' + ptvDevID
  let signature = crypto.createHmac('SHA1', ptvKey).update(request).digest('hex').toString('hex')
  return 'https://timetableapi.ptv.vic.gov.au' + request + '&signature=' + signature
}

async function makeRequest(url, maxRetries=2, timeout=1900) {
  try {
    return await utils.getData('ptv-api', url, async () => {
      let start = +new Date()

      let data = JSON.parse(await utils.request(getURL(url), {
        maxRetries,
        timeout
      }))

      let end = +new Date()
      let diff = end - start

      past50ResponseTimes = [...past50ResponseTimes.slice(-49), diff]

      return data
    })
  } catch (e) {
    throw e
  }
}

async function getPTVKey(baseURL='https://ptv.vic.gov.au') {
  return await utils.getData('ptv-key', baseURL, async () => {
    let ptvData = await utils.request(baseURL, {
      timeout: 6000
    })

    let $ = cheerio.load(ptvData)
    let key = $('#fetch-key').val()

    return key
  }, 1000 * 60 * 60)
}


function getAverageResponseTime() {
  let counts = past50ResponseTimes.length
  let sum = past50ResponseTimes.reduce((a, b) => a + b, 0)
  let average = sum / counts

  return average
}

module.exports = makeRequest
module.exports.getPTVKey = getPTVKey
module.exports.getAverageResponseTime = getAverageResponseTime
