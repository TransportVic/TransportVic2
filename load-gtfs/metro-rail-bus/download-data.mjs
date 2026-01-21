import urls from '../../urls.json' with { type: 'json' }
import utils from '../../utils.mjs'
import AdmZip from 'adm-zip'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import async from 'async'
import operators from './operators.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gtfsFolder = path.join(__dirname, '..', '..', 'gtfs', 'mtm-rail')
try { await fs.rm(gtfsFolder, { recursive: true }) } catch (e) {}
try { await fs.mkdir(gtfsFolder) } catch (e) {}

async function downloadGTFS(operator) {
  let data
  try {
    data = await utils.request(urls.metroRRBGTFS.format(operator), {
      raw: true,
      timeout: 60 * 1000 * 10
    })
  } catch (e) {
    console.error('Failed to download GTFS, exiting', e)
    return
  }

  const operatorFolder = path.join(gtfsFolder, operator)
  await fs.mkdir(operatorFolder)

  console.log('Deleted existing files')

  let gtfsFilePath = path.join(operatorFolder, 'gtfs.zip')
  await fs.writeFile(gtfsFilePath, data)
  console.log('Wrote GTFS Zip for', operator)
  
  let zip = new AdmZip(gtfsFilePath)
  zip.extractAllTo(operatorFolder, true)
}

export async function downloadData() {
  await async.forEach(operators, downloadGTFS)
}