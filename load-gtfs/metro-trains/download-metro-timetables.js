const async = require('async')
const fs = require('fs')
const urls = require('../../urls.json')
const utils = require('../../utils')
require('../../setup')

function getLineTimetableURL(lineID) {
  return urls.metroTrainsTimetable.format(lineID)
}

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

async function downloadTimetables () {
  await async.forEach(Object.keys(lineIDs), async lineName => {
    const lineID = lineIDs[lineName]
    const requestURL = getLineTimetableURL(lineID)
    const body = await utils.request(requestURL)

    await new Promise(resolve => fs.writeFile('load_gtfs/metro_trains/timetables/' + lineName + '.json', body, resolve))
  })

  console.log('Completed downloading ' + Object.keys(lineIDs).length + ' MTM timetables')
  process.exit()
}

downloadTimetables()
