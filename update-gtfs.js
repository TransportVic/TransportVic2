const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const urls = require('./urls')
const AdmZip = require('adm-zip')

function walk(dir, done) {
  let results = []
  let dirs = []
  fs.readdir(dir, function(err, list) {
    if (err) return done(err)
    let i = 0
    function next() {
      let file = list[i++]
      if (!file) {
        results = results.concat(dirs)
        return done(null, results)
      }

      file = path.resolve(dir, file)
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          dirs.push({file: false, path: file})
          walk(file, function(err, res) {
            results = results.concat(res)
            next()
          })
        } else {
          results.push({file: true, path: file})
          next()
        }
      })
    }
    next()
  })
}

function downloadGTFS(done) {
  utils.request(urls.gtfsFeed, {
    raw: true,
    timeout: 60 * 1000
  }).then(data => {
    walk(path.join(__dirname, 'gtfs'), (err, files) => {
      walk(path.join(__dirname, 'load-gtfs', 'spliced-gtfs-stuff'), (err, spliced) => {
        let allFiles = (files || []).concat(spliced || [])
        for (let file of allFiles) {
          try {
            if (file.file) fs.unlinkSync(file.path)
            else fs.rmdirSync(file.path)
          } catch (err) {}
        }
        console.log('Deleted existing files')

        let gtfsFilePath = path.join(__dirname, 'gtfs', 'gtfs.zip')
        fs.writeFile(gtfsFilePath, data, () => {
          console.log('Wrote GTFS Zip')
          data = null

          let zip = new AdmZip(gtfsFilePath)
          zip.extractAllTo(path.join(__dirname, 'gtfs'), true)
          for (let i = 1; i <= 11; i++) {
            if (i !== 9) {
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
      })
    })
  }).catch(err => {
    console.error('Failed to download GTFS, exiting')
    done(1)
  })
}

module.exports = downloadGTFS
