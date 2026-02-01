const tfnswAPI = require('../../modules/xpt/tfnsw-api')
const fs = require('fs')
const path = require('path')
const updateStats = require('../utils/stats')
const utils = require('../../utils.mjs')
const AdmZip = require('adm-zip')

tfnswAPI.makeRequest('/v1/gtfs/schedule/nswtrains', {
  stream: true,
  timeout: 30000
}).then(async res => {
  let folder = path.join(__dirname, '../../gtfs/14')
  try { await utils.rmDir(folder) } catch (e) {}
  fs.mkdirSync(folder, { recursive: true })

  let gtfsFilePath = path.join(folder, 'google_transit.zip')

  let stream = fs.createWriteStream(gtfsFilePath)
  res.pipe(stream)

  stream.on('error', console.log)
  stream.on('close', async () => {
    console.log('Wrote GTFS Zip');
    let zip = new AdmZip(gtfsFilePath)
    zip.extractAllTo(folder, true)

    await updateStats('download-xpt-timetables', 1)
    console.log('Completed downloading xpt timetables')
    process.exit()
  })
}).catch(console.log)
