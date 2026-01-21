import async from 'async'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import utils from '../../utils.mjs'
import urls from '../../urls.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

await fs.mkdir(path.join(__dirname, 'timetables'), { recursive: true })

await async.forEach(Object.keys(lineIDs), async lineName => {
  let lineID = lineIDs[lineName]
  let body = await utils.request(urls.metroWorkingTimetable.format(lineID), {
    timeout: 300000
  })

  let filePath = path.join(__dirname, 'timetables', `${lineName}.json`)

  await fs.writeFile(filePath, body)
})