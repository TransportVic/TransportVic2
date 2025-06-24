const async = require('async')
const fs = require('fs')
const path = require('path')
const utils = require('../../utils')
const urls = require('../../urls')

const lineIDs = {
  'alamein': '82',
  'belgrave': '84',
  'craigieburn': '85',
  'cranbourne': '86',
  'frankston': '88',
  'glen-waverley': '89',
  'hurstbridge': '90',
  'lilydale': '91',
  'pakenham': '92',
  'sandringham': '93',
  'mernda': '87',
  'stony-point': '94',
  'sunbury': '95',
  'upfield': '96',
  'werribee': '97',
  'williamstown': '98'
}

async function main () {
  fs.mkdirSync(path.join(__dirname, 'timetables'), { recursive: true })

  await async.forEach(Object.keys(lineIDs), async lineName => {
    let lineID = lineIDs[lineName]
    let body = await utils.request(urls.metroWorkingTimetable.format(lineID), {
      timeout: 300000
    })

    let filePath = path.join(__dirname, 'timetables', lineName + '.json')

    await new Promise(resolve => fs.writeFile(filePath, body, resolve))
  })
}

main()
