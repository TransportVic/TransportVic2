const crypto = require('crypto')
const { ptvKeys } = require('./config.json')
const utils = require('./utils')
const cheerio = require('cheerio')

let blankKey = {ptvDevID: "", ptvKey: ""}

let pastResponseTimes = []
let ptvResponses = []

setInterval(() => {
  let now = +new Date()
  let hour = 1000 * 60 * 60
  ptvResponses = ptvResponses.filter(resp => now - resp.time <= hour)
}, 1000 * 60)

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

async function makeRequest(url, maxRetries=2, timeout=2400) {
  try {
    return await utils.getData('ptv-api', url, async () => {
      let start = +new Date()

      let data = JSON.parse(await utils.request(getURL(url), {
        maxRetries,
        timeout
      }))

      let end = +new Date()
      let diff = end - start

      pastResponseTimes = [...pastResponseTimes.slice(-39), diff]

      if (data.Message === 'An error has occurred.') {
        ptvResponses.push({
          time: end,
          fault: true
        })
        throw new Error('PTV API Fault')
      } else {
        ptvResponses.push({
          time: end,
          fault: false
        })
      }

      return data
    }, 5000)
  } catch (e) {
    if (e.message && e.message.toLowerCase().includes('network timeout')) {
      pastResponseTimes = [...pastResponseTimes.slice(-99), e.timeoutDuration]
      return null
    } else {
      throw e
    }
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
  let counts = pastResponseTimes.length
  let sum = pastResponseTimes.reduce((a, b) => a + b, 0)
  let average = sum / counts

  return average
}

function getFaultRate() {
  let faulty = ptvResponses.filter(r => r.fault).length
  return {
    rate: faulty / ptvResponses.length * 100,
    count: faulty
  }
}

module.exports = makeRequest
module.exports.getPTVKey = getPTVKey
module.exports.getAverageResponseTime = getAverageResponseTime
module.exports.getFaultRate = getFaultRate
