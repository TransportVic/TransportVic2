const async = require('async')
const utils = require('../../utils')
const cheerio = require('cheerio')
const fs = require('fs')
const https = require('https')
const path = require('path')

let baseURL = 'https://corporate.vline.com.au'

function wait500() {
  return new Promise(resolve => {
    setTimeout(resolve, 500)
  })
}

async function main() {
  fs.mkdirSync(path.join(__dirname, 'timetables'), { recursive: true })

  let body = await utils.request('https://corporate.vline.com.au/Network-Access/Network-service-plan', {
    timeout: 30000
  })
  let $ = cheerio.load(body)
  let as = Array.from($('div[id="publication-list"]:nth-child(3) a'))
  let links = as.map(a => [baseURL + $(a).attr('href'), $(a).text().trim()]).filter(link => {
    return !link[1].includes('Central')
  })

  await async.forEachSeries(links, async link => {
    let filePath = path.join(__dirname, 'timetables', link[1] + '.pdf')
    let fileBuffer = await utils.request(link[0], {
      timeout: 30 * 1000,
      raw: true
    })

    await new Promise(resolve => {
      fs.writeFile(filePath, fileBuffer, resolve)
    })
    await wait500()
  })

  console.log('Completed downloading ' + links.length + ' PDF timetables from V/Line')
  process.exit(0)
}

main()
