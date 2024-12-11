const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const urls = require('./urls')
const AdmZip = require('adm-zip')

async function downloadGTFS(done) {
  let data
  try {
    data = await utils.request(urls.gtfsFeed, {
      raw: true,
      timeout: 60 * 1000 * 10
    })
  } catch (e) {
    console.error('Failed to download GTFS, exiting')
    console.error(e)
    done(1)
  }

  let gtfsFolder = path.join(__dirname, 'gtfs')

  try { await utils.rmDir(gtfsFolder) } catch (e) {}
  try { await utils.rmDir(path.join(__dirname, 'load-gtfs', 'spliced-gtfs-stuff')) } catch (e) {}

  await new Promise(resolve => fs.mkdir(gtfsFolder, resolve))

  console.log('Deleted existing files')

  let gtfsFilePath = path.join(gtfsFolder, 'gtfs.zip')
  fs.writeFile(gtfsFilePath, data, () => {
    console.log('Wrote GTFS Zip')
    data = null

    let zip = new AdmZip(gtfsFilePath)
    zip.extractAllTo(path.join(__dirname, 'gtfs'), true)
    for (let i = 1; i <= 11; i++) {
      if ([7, 8, 9].includes(i)) {
        try {
          let unzipPath = path.join(__dirname, 'gtfs', i.toString())
          let zip = new AdmZip(path.join(unzipPath, 'google_transit.zip'))
          zip.extractAllTo(unzipPath, true)
          console.log('Unzipped GTFS Pack', i)
        } catch (err) {
          console.log('Failed to unzip ' + i)
        }
      }
    }
    done(0)
  })
}

if (process.argv[1] && process.argv[1] === __filename) downloadGTFS(r => process.exit(r))
else module.exports = downloadGTFS
