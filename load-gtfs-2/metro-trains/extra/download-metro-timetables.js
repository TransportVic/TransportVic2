const async = require('async')
const fs = require('fs')
const path = require('path')
const utils = require('../../../utils')
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
    const body = await utils.request('https://040977037015-static-assets-staging.s3-ap-southeast-2.amazonaws.com/current_timetable_{0}.json'.format(lineID))

    let filePath = path.join(__dirname, 'timetables', lineName + '.json')

    await new Promise(resolve => fs.writeFile(filePath, body, resolve))
  })

  updateStats('download-mtm-timetables', Object.keys(lineIDs).length)
}

main()
