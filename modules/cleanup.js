const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const fs = require('fs')
const path = require('path')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

function trimLog(filename) {
  let dateRegex = /\] \[(.*?)\]: /
  let end = utils.now().add(-14, 'days')

  let data = fs.readFileSync(filename).toString().split('\n')
  let recentLogs = data.filter(line => {
    let date = new Date((line.match(dateRegex) || [])[1])
    return date - end >= 0
  })
  fs.writeFileSync(filename, recentLogs.join('\n'))
  return data.length - recentLogs.length
}

function walk(dir, done) {
  let results = []
  fs.readdir(dir, function(err, list) {
    if (err) return done(err)
    let i = 0
    function next() {
      let file = list[i++]
      if (!file) return done(null, results)
      file = path.resolve(dir, file)
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res)
            next()
          })
        } else {
          results.push(file)
          next()
        }
      })
    }
    next()
  })
}


database.connect(async () => {
  console.log('Starting cleanup on', utils.now().toLocaleString())
  let metroNotify = database.getCollection('metro notify')
  let liveTimetables = database.getCollection('live timetables')

  let notify = await metroNotify.deleteDocuments({
    toDate: {
      $lte: utils.now().add(-14, 'days') / 1000
    }
  })

  console.log('Cleaned up', notify.nRemoved, 'notify alerts')

  let firstDocument = await liveTimetables.findDocuments({})
    .sort({ operationDays: 1 }).limit(1).next()

  let start = utils.parseDate(firstDocument.operationDays)
  let end = utils.now().add(-14, 'days')

  let days = utils.allDaysBetweenDates(start, end).map(date => utils.getYYYYMMDD(date))

  let live = await liveTimetables.deleteDocuments({
    operationDays: {
      $in: days
    }
  })

  console.log('Cleaned up', live.nRemoved, 'live timetables')

  console.log('Removed', trimLog(config.combinedLog), 'lines from combined log')
  walk(path.join(__dirname, '../logs'), (err, results) => {
    results.forEach(filename => {
      let logName = filename.replace(/.*?\/logs\//, '')
      console.log('Removed', trimLog(filename), 'lines from', logName)
    })
    process.exit()
  })
})
