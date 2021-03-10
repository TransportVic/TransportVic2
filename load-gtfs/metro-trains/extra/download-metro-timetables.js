const async = require('async')
const fs = require('fs')
const path = require('path')
const utils = require('../../../utils')
const urls = require('../../../urls')
const updateStats = require('../../utils/stats')

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
    const lineID = lineIDs[lineName]
    const body = await utils.request(urls.metroTrainsTimetable.format(lineID), {
      timeout: 20000
    })

    let filePath = path.join(__dirname, 'timetables', lineName + '.json')

    await new Promise(resolve => fs.writeFile(filePath, body, resolve))
  })

  updateStats('download-mtm-timetables', Object.keys(lineIDs).length)
}

main()
