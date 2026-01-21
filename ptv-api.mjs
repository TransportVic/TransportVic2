import crypto from 'crypto'
import config from './config.json' with { type: 'json' }
import utils from './utils.mjs'

const { ptvKeys } = config

let blankKey = {ptvDevID: "", ptvKey: ""}

let pastResponseTimes = []
let ptvResponses = []

setInterval(() => {
  let now = +new Date()
  let hour = 1000 * 60 * 60
  ptvResponses = ptvResponses.filter(resp => now - resp.time <= hour)
}, 1000 * 60)

export function getPTVCreds() {
  if (ptvKeys.length === 0) return blankKey

  let key = ptvKeys[Math.floor(Math.random() * ptvKeys.length)]
  return {
    ptvDevID: key.devID,
    ptvKey: key.key
  }
}

export function getURL(request) {
  let {ptvDevID, ptvKey} = getPTVCreds()
  request += (request.includes('?') ? '&' : '?') + 'devid=' + ptvDevID
  let signature = crypto.createHmac('SHA1', ptvKey).update(request).digest('hex').toString('hex')
  return 'https://timetableapi.ptv.vic.gov.au' + request + '&signature=' + signature
}

export default async function makeRequest(url, maxRetries=2, timeout=2400) {
  try {
    return await utils.getData('ptv-api', url, async () => {
      let start = +new Date()

      let data = {}, error
      try {
        data = JSON.parse(await utils.request(getURL(url), {
          maxRetries,
          timeout
        }))
      } catch (e) {
        error = e
        if (e.response) data = JSON.parse(e.response)
      }

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

      if (error) throw error
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

export function getPTVKey(baseURL='https://ptv.vic.gov.au', timeout=6000) {
  return 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3NTM4NjQ4MDgsIm5iZiI6MTc1Mzg2NDgwOCwiZXhwIjo0OTA3NDY0ODA4LCJ1c3IiOiJ0cmFuc3BvcnR2aWN0b3JpYSIsImRvbWFpbnMiOiIqcHR2LnZpYy5nb3YuYXUsKnRyYW5zcG9ydC52aWMuZ292LmF1In0.LkqiufBLCq000ecdzrQYjFug2mGRJb7GP15xDSIRxNPYI6GoovzDzF3TxL4diKVJ6ZkuKGCvo7OrY6u3-gOEFw'
}


export function getAverageResponseTime() {
  let counts = pastResponseTimes.length
  let sum = pastResponseTimes.reduce((a, b) => a + b, 0)
  let average = sum / counts

  return average
}

export function getFaultRate() {
  let faulty = ptvResponses.filter(r => r.fault).length
  return {
    rate: faulty / ptvResponses.length * 100,
    count: faulty
  }
}
