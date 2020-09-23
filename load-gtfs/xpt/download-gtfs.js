const tfnswAPI = require('../../modules/xpt/tfnsw-api.js')
const fs = require('fs')
const path = require('path')

tfnswAPI.makeRequest('/v1/gtfs/schedule/nswtrains', {
  raw: true
}).then(res => {
  let folder = path.join(__dirname, '../../gtfs/14')
  fs.mkdirSync(folder, { recursive: true })
  res.body.pipe(fs.createWriteStream(path.join(folder, 'google_transit.zip')))
}).catch(console.log)
