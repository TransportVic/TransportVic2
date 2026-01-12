import generateGTFS from '../modules/journey-planner/generate-gtfs.mjs'
import { getAvailableServers, isPrimary } from '../modules/replication.mjs'
import url from 'url'
import config from '../config.json' with { type: 'json' }
import utils from '../utils.js'
import fetch from 'node-fetch'
import { createReadStream } from 'fs'
import fs from 'fs/promises'

async function sendGTFS(server, gtfsFile) {
  const readStream = createReadStream(gtfsFile)
  const request = await fetch(`http://${server}/update-gtfs`, { method: 'POST', body: readStream })

  console.log(await request.text())
}

if (await fs.realpath(process.argv[1]) === url.fileURLToPath(import.meta.url) && await isPrimary()) {
  const gtfsFile = await generateGTFS()
  const jpBuildServer = utils.shuffle(config.jpServers.slice(0))[0]
  // const servers = await getAvailableServers()

  await sendGTFS(jpBuildServer, gtfsFile)
}