const async = require('async')
const utils = require('../../../utils')
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

  let body = await utils.request('https://corporate.vline.com.au/Network-Access/Network-service-plan')
  let $ = cheerio.load(body)
  let as = Array.from($('div[id="publication-list"]:nth-child(3) a'))
  let links = as.map(a => [baseURL + $(a).attr('href'), $(a).text().trim()])

  await async.forEachSeries(links, async link => {
    if (link[1].includes('Central')) return
    
    let file = fs.createWriteStream(path.join(__dirname, 'timetables', link[1] + '.pdf'))
    let start = new Date()
    await new Promise(r => {
        https.get(link[0], res => {
        res.pipe(file)
        let end = new Date()
        console.log((end - start) + 'ms ' + link[0])
        r()
      })
    })
    await wait500()
  })

  console.log('Completed downloading ' + links.length + ' PDF timetables from V/Line')
}

main()
