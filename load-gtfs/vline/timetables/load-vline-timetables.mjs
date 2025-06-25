import { NSPFile } from '@transportme/vline-nsp-reader'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import currentVersion from './timetables/ver.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let nspFolder = path.join(__dirname, 'timetables')
let versionFile = path.join(nspFolder, 'ver.json')
let nspFileNames = await fs.readdir(nspFolder)

let nspFiles = []
for (let file of nspFileNames) {
  if (!file.endsWith('.pdf') || file.includes('Central') || file.includes('Freight')) continue
  let nspFile = new NSPFile(file.slice(0, -4), null, currentVersion.version)
  nspFile.setFilePath(path.join(nspFolder, file))
  nspFiles.push(nspFile)
}

let allRuns = {}

for (let file of nspFiles) {
 console.log('Reading', file)
  let runs = await file.extractRuns()
  for (let run of runs) {
    if (run.movementType !== 'PSNG_SRV') continue
    let runID = `${run.tdn}-${run.daysRunCode}`
    if (!allRuns[runID]) allRuns[runID] = run
  }
}

console.log(allRuns)