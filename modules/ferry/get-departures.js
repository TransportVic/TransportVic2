const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const utils = require('../../utils')
const EventEmitter = require('events')


async function getDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'ferry')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'ferry', 180, false)
}

module.exports = getDepartures
