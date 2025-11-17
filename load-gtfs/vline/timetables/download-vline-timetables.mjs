import { getNSPVersion } from '@transportme/vline-nsp-reader'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let currentVersion = { effective: 0 }
let nspFolder = path.join(__dirname, 'timetables')
let versionFile = path.join(nspFolder, 'ver.json')
try {
  await fs.mkdir(nspFolder)
} catch (e) {}
try {
  currentVersion = JSON.parse(await fs.readFile(versionFile))
} catch (e) {}

let nspFiles

let latestVersion = (await getNSPVersion())[0]
if (latestVersion.effective > currentVersion.effective) {
  console.log(`Updating NSP to ${latestVersion.version}`)
  if (await fs.stat(nspFolder)) await fs.rm(nspFolder, { recursive: true })
  await fs.mkdir(nspFolder)

  await latestVersion.saveFiles(nspFolder)
  currentVersion = { version: latestVersion.version, effective: +latestVersion.effective }
  await fs.writeFile(versionFile, JSON.stringify(currentVersion))

  nspFiles = latestVersion.files
} else {
  console.log('NSP up to date')
}