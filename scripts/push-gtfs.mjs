import generateGTFS from '../modules/journey-planner/generate-gtfs.mjs'
import { getAvailableServers, isPrimary } from '../modules/replication.mjs'
import url from 'url'
import config from '../config.json' with { type: 'json' }
import utils from '../utils.mjs'
import fetch from 'node-fetch'
import { createReadStream } from 'fs'
import fs from 'fs/promises'

async function sendGTFS(server, gtfsFile) {
  const readStream = createReadStream(gtfsFile)
  const request = await fetch(`http://${server}/gtfs/update`, { method: 'POST', body: readStream })
  await request.text()
}

async function buildGTFS(server) {
  const request = await fetch(`http://${server}/gtfs/build`)
  await request.text()
}

if (await fs.realpath(process.argv[1]) === url.fileURLToPath(import.meta.url) && await isPrimary()) {
  // const gtfsFile = await generateGTFS()
  const gtfsFile = '/Users/edwardyeung/Projects/TransportVic/jp-gtfs/gtfs.zip'
  const jpBuildServer = utils.shuffle(config.jpServers.slice(0))[0]
  // const servers = await getAvailableServers()

  await sendGTFS(jpBuildServer, gtfsFile)
  await buildGTFS(jpBuildServer)
}