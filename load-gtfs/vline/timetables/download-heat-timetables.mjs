import { getHeatTimetables } from '@transportme/vline-nsp-reader'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import utils from '../../../utils.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let currentVersion
let heatTTFolder = path.join(__dirname, 'heat-timetables')
let versionFile = path.join(heatTTFolder, 'ver.json')
try {
  await fs.mkdir(heatTTFolder)
} catch (e) {}
try {
  currentVersion = JSON.parse(await fs.readFile(versionFile))
} catch (e) {}

let files

let timetables = await getHeatTimetables()
let fileCount = (await fs.readdir(heatTTFolder)).filter(f => f !== 'ver.json').length

if (!currentVersion || utils.now().add(-1, 'month') > currentVersion.effective || fileCount !== timetables.files.length) {
  console.log('Refreshing heat timetables')
  if (await fs.stat(heatTTFolder)) await fs.rm(heatTTFolder, { recursive: true })
  await fs.mkdir(heatTTFolder)

  await timetables.saveFiles(heatTTFolder)
  currentVersion = { effective: +new Date() }
  await fs.writeFile(versionFile, JSON.stringify(currentVersion))

  files = timetables.files
} else {
  console.log('Heat timetables up to date')
}