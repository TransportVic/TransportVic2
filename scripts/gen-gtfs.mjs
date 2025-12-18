import config from '../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import GTFSGenerator from '../modules/journey-planner/gtfs-generator/GTFSGenerator.mjs'
import fs from 'fs/promises'
import AdmZip from 'adm-zip'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.join(__dirname, '..')

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect({})

const outputFolder = path.join('jp-gtfs')
try {
  await fs.rm(outputFolder, { recursive: true })
} catch (e) {}
await fs.mkdir(outputFolder)

const generator = new GTFSGenerator(
  database,
  path.join(root, 'gtfs'),
  outputFolder,
)

await generator.writeFiles()

const zip = new AdmZip()
await zip.addLocalFolderPromise(outputFolder)

await zip.writeZipPromise(path.join(outputFolder, 'gtfs.zip'))

database.close()