const daylightSavings = require('../../../daylight-savings').slice(0, 2)
const utils = require('../../../utils')

function dateRange(name, start, end, type) {
  let startDate = utils.parseDate(start)
  let endDate = utils.parseDate(end)

  let allDatesInbetween = utils.allDaysBetweenDates(startDate, endDate)

  return allDatesInbetween.map(date => {
    return [name, utils.getYYYYMMDD(date), type]
  })
}

let generateExclusion = (name, start, end) => dateRange(name, start, end, '2')
let generateInclusion = (name, start, end) => dateRange(name, start, end, '1')

let ENTRANCE_STOP = '11844'
let QUARANTINE_STATION = '12000001'
let GUNNERS_COTTAGE = '12000002'
let CHEVIOT_HILL = '12000003'
let FORT_PEARCE = '12000004'
let FORT_NEPEAN = '12000005'
let ROUTE_GTFS_ID = '12-PNS'

let baseDownTripTimes = [
  {
    "stopGTFSID": ENTRANCE_STOP,
    "departureTimeMinutes": -5
  },
  {
    "stopGTFSID": QUARANTINE_STATION,
    "departureTimeMinutes": 0
  },
  {
    "stopGTFSID": GUNNERS_COTTAGE,
    "departureTimeMinutes": 3
  },
  {
    "stopGTFSID": CHEVIOT_HILL,
    "departureTimeMinutes": 5
  },
  {
    "stopGTFSID": FORT_PEARCE,
    "departureTimeMinutes": 6
  },
  {
    "stopGTFSID": FORT_NEPEAN,
    "departureTimeMinutes": 7
  }
]

let baseUpTripTimes = [
  {
    "stopGTFSID": FORT_NEPEAN,
    "departureTimeMinutes": 0
  },
  {
    "stopGTFSID": FORT_PEARCE,
    "departureTimeMinutes": 1
  },
  {
    "stopGTFSID": CHEVIOT_HILL,
    "departureTimeMinutes": 2
  },
  {
    "stopGTFSID": GUNNERS_COTTAGE,
    "departureTimeMinutes": 4
  },
  {
    "stopGTFSID": QUARANTINE_STATION,
    "departureTimeMinutes": 7
  },
  {
    "stopGTFSID": ENTRANCE_STOP,
    "departureTimeMinutes": 12
  },
]

function generateTripTimes(direction, departureTime, tripID, hasFrontEntrance) {
  let baseTrip = direction === 'Up' ? baseUpTripTimes : baseDownTripTimes
  let stopTimings = baseTrip.slice(0)
  if (!hasFrontEntrance) {
    if (direction === 'Up') stopTimings.pop()
    else stopTimings.shift()
  }

  return {
    tripID,
    stopTimings: stopTimings.map(stop => {
      let minutesPastMidnight = stop.departureTimeMinutes + departureTime
      let time = utils.getHHMMFromMinutesPastMidnight(minutesPastMidnight) + ':00'
      return {
        "stopGTFSID": stop.stopGTFSID,
        "arrivalTime": time,
        "departureTime": time,
        "stopConditions": {
          "dropoff": 0, "pickup": 0
        },
        "stopDistance": 0,
        "stopSequence": 0
      }
    })
  }
}

function addTrip(direction, departureHour, departureMinute, headsign, calendarID, hasFrontEntrance) {
  let shapeID = `${ROUTE_GTFS_ID}-${hasFrontEntrance ? 'B' : 'A'}-mjp-1.1.${direction === 'Down' ? 'H' : 'R'}`
  let tripID = `${utils.pad(departureHour, 2)}${utils.pad(departureMinute, 2)}.${calendarID}.${shapeID}`

  module.exports.trips.push({
    'mode': 'bus',
    'routeGTFSID': ROUTE_GTFS_ID,
    'calendarID': calendarID,
    'tripID': tripID,
    'gtfsDirection': direction === 'Down' ? '0' : '1',
    'shapeID': shapeID,
    'headsign': headsign
  })

  module.exports.timings.push(generateTripTimes(direction, departureHour * 60 + departureMinute, tripID, hasFrontEntrance))
}

let everydayBase = ["1", "1", "1", "1", "1", "1", "1"]

let dstBlocks = daylightSavings.filter(block => block.isDST).map((block, i) => {
  return [`EVERYDAY_DST_${String.fromCharCode(65 + i)}`, ...everydayBase, block.start, block.end]
})

let nonDSTBlocks = daylightSavings.filter(block => !block.isDST).map((block, i) => {
  return [`EVERYDAY_NONDST_${String.fromCharCode(65 + i)}`, ...everydayBase, block.start, block.end]
})

let everydayBlock = ['EVERYDAY', ...everydayBase, daylightSavings[0].start, daylightSavings.slice(-1)[0].end]

module.exports = {
  'days': [
    ...dstBlocks,
    ...nonDSTBlocks,
    everydayBlock
  ],
  'dates': [],
  'trips': [],
  'timings': []
}

addTrip('Down', 10, 30, 'Fort Nepean', 'EVERYDAY', true)
for (let hour = 11; hour <= 12; hour++) {
  addTrip('Down', hour,  0, 'Fort Nepean', 'EVERYDAY', false)
  addTrip('Down', hour, 30, 'Fort Nepean', 'EVERYDAY', false)
}
addTrip('Down', 13, 35, 'Fort Nepean', 'EVERYDAY', true)
for (let hour = 14; hour <= 15; hour++) {
  addTrip('Down', hour,  0, 'Fort Nepean', 'EVERYDAY', false)
  addTrip('Down', hour, 30, 'Fort Nepean', 'EVERYDAY', false)
}

dstBlocks.forEach(block => {
  addTrip('Down', 16, 15, 'Fort Nepean', block[0], false)
})

for (let hour = 10; hour <= 11; hour++) {
  addTrip('Up', hour, 45, 'Front Entrance', 'EVERYDAY', false)
  addTrip('Up', hour + 1, 15, 'Front Entrance', 'EVERYDAY', false)
}
addTrip('Up', 12, 45, 'Front Entrance', 'EVERYDAY', true)
addTrip('Up', 14, 15, 'Front Entrance', 'EVERYDAY', false)
addTrip('Up', 14, 45, 'Front Entrance', 'EVERYDAY', false)
addTrip('Up', 15, 15, 'Front Entrance', 'EVERYDAY', false)
nonDSTBlocks.forEach(block => {
  addTrip('Up', 16,  0, 'Front Entrance', block[0], true) // Non DST - Operates to Front Entrance
})
dstBlocks.forEach(block => {
  addTrip('Up', 16,  0, 'Front Entrance', block[0], false) // DST - Operates to Quarantine Station only
  addTrip('Up', 16, 30, 'Front Entrance', block[0], true) // DST - Operates to Front Entrance
})
