#! /usr/bin/env node

const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const fs = require('fs')
const path = require('path')
const readLastLines = require('read-last-lines')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

function trimLog(filename, isCombined) {
  let dateRegex = /\] \[(.*?)\]: /
  let cutoff = 14

  if (filename.includes('fetch')) cutoff = 1
  if (filename.includes('trackers')) cutoff = 1
  if (filename.includes('http')) cutoff = 3
  if (filename.includes('certs')) cutoff = 7
  if (filename.includes('mail')) cutoff = 21
  if (filename.includes('errors')) cutoff = 28
  if (filename.includes('mockups')) cutoff = 6

  if (filename.includes('general')) cutoff = 6

  if (isCombined) cutoff = 2

  let end = utils.now().add(-cutoff, 'days')

  let data = fs.readFileSync(filename).toString().split('\n')
  let lastDate

  let recentLogs = data.filter(line => {
    let date = new Date((line.match(dateRegex) || [])[1])

    if (date) lastDate = date
    else date = lastDate

    return date - end >= 0
  })

  fs.writeFileSync(filename, recentLogs.join('\n') + '\n')

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
  let metroShunts = database.getCollection('metro shunts')
  let csrfTokens = database.getCollection('csrf tokens')

  try {
    let notify = await metroNotify.deleteDocuments({
      toDate: {
        $lte: utils.now().add(-14, 'days') / 1000
      }
    })

    console.log('Cleaned up', notify.nRemoved, 'notify alerts')
  } catch (e) {
    console.log('Failed to clean up notify data')
  }

  try {
    let csrf = await csrfTokens.deleteDocuments({
      created: {
        $lte: +utils.now().add(-1, 'days')
      }
    })

    console.log('Cleaned up', csrf.nRemoved, 'csrf tokens')
  } catch (e) {
    console.log('Failed to clean up csrf tokens')
  }

  try {
    let firstTrip = await liveTimetables.findDocuments({})
      .sort({ operationDays: 1 }).limit(1).next()

    let tripsStart = utils.parseDate(firstTrip.operationDays)
    let tripsEnd = utils.now().add(-31, 'days')

    let tripsDay = utils.allDaysBetweenDates(tripsStart, tripsEnd).map(date => utils.getYYYYMMDD(date))

    let liveRemoval = await liveTimetables.deleteDocuments({
      operationDays: {
        $in: tripsDay
      }
    })

    console.log('Cleaned up', liveRemoval.nRemoved, 'live timetables')
  } catch (e) {
    console.log('Failed to clean up live trips')
  }

  try {
    let firstShunt = await metroShunts.findDocuments({})
      .sort({ date: 1 }).limit(1).next()

    let shuntsRemoved = { nRemoved: 0 }
    if (firstShunt) {
      let shuntStart = utils.parseDate(firstShunt.date)
      let shuntEnd = utils.now().add(-27, 'days')

      let shuntDays = utils.allDaysBetweenDates(shuntStart, shuntEnd).map(date => utils.getYYYYMMDD(date))

      shuntsRemoved = await metroShunts.deleteDocuments({
        date: {
          $in: shuntDays
        }
      })
    }

    console.log('Cleaned up', shuntsRemoved.nRemoved, 'metro shunts')
  } catch (e) {
    console.log(e)
    console.log('Failed to clean up metro shunts')
  }

  try {
    console.log('Removed', trimLog(config.combinedLog, true), 'lines from combined log')
  } catch (e) {
    if (e.toString().includes('FILE_TOO_LARGE')) {
      console.log('Combined log too large to clean, using only last 5000 lines')
      readLastLines.read(config.combinedLog, 5000).then(lines => {
        fs.writeFileSync(config.combinedLog, lines.join('\n') + '\n')
      })
    } else {
      console.log('Failed to clean up combined log')
    }
  }

  walk(path.join(__dirname, '../logs'), (err, results) => {
    results.forEach(filename => {
      let logName = filename.replace(/.*?\/logs\//, '')
      try {
        console.log('Removed', trimLog(filename, false), 'lines from', logName)
      } catch (e) {
        console.log('Failed to clean up logfile', logName)
      }
    })
    process.exit()
  })
})
