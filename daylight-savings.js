const utils = require('./utils')
const ical = require('node-ical')
const path = require('path')

let rawEvents = ical.sync.parseFile(path.join(__dirname, 'additional-data/daylight-saving.ics'))
let events = Object.values(rawEvents).slice(1)

let daylightBlocks = []

let currentBlock
events.forEach(event => {
  let start = event.start.toISOString()
  let timestamp = utils.parseTime(start)
  let day = utils.getYYYYMMDD(timestamp)
  let name = event.summary

  if (name.includes('begins')) {
    currentBlock = {
      start: day,
      startTime: timestamp
    }
  } else {
    currentBlock.end = day
    currentBlock.endTime = timestamp
    daylightBlocks.push(currentBlock)
  }
})

let timeBlocks = []
daylightBlocks.forEach((block, i) => {
  if (i !== 0) {
    let previous = daylightBlocks[i - 1]
    let previousEnd = previous.endTime
    let currentStart = block.startTime

    let nonDSTStart = previousEnd.clone().add(1, 'day')
    let nonDSTEnd = currentStart.clone().add(-1, 'day')
    timeBlocks.push({
      isDST: false,
      start: utils.getYYYYMMDD(nonDSTStart),
      end: utils.getYYYYMMDD(nonDSTEnd),
    })
  }

  timeBlocks.push({
    isDST: true,
    start: block.start,
    end: block.end
  })
})

let lastBlock = daylightBlocks.slice(-1)[0]
let nextNonDSTStart = lastBlock.endTime.clone().add(1, 'day')
let nextNonDSTEnd = nextNonDSTStart.clone().add(6, 'months')

timeBlocks.push({
  isDST: false,
  start: utils.getYYYYMMDD(nextNonDSTStart),
  end: utils.getYYYYMMDD(nextNonDSTEnd)
})

module.exports = timeBlocks
