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

let MONASH_CLAYTON = '19807'
let MONASH_PENINSULA = '48017'
let ROUTE_GTFS_ID = '12-MCP'

let baseDownTripTimes = [
  {
    'stopGTFSID': MONASH_CLAYTON,
    'departureTimeMinutes': 0
  },
  {
    'stopGTFSID': MONASH_PENINSULA,
    'departureTimeMinutes': 40
  }
]

let baseUpTripTimes = [
  {
    'stopGTFSID': MONASH_PENINSULA,
    'departureTimeMinutes': 0
  },
  {
    'stopGTFSID': MONASH_CLAYTON,
    'departureTimeMinutes': 40
  }
]

function generateTripTimes(direction, departureTime, tripID) {
  let baseTrip = direction === 'Up' ? baseUpTripTimes : baseDownTripTimes
  return {
    tripID,
    stopTimings: baseTrip.map(stop => {
      let minutesPastMidnight = stop.departureTimeMinutes + departureTime
      let time = utils.getHHMMFromMinutesPastMidnight(minutesPastMidnight) + ':00'
      return {
        'stopGTFSID': stop.stopGTFSID,
        'arrivalTime': time,
        'departureTime': time,
        'stopConditions': {
          'dropoff': 0, 'pickup': 0
        },
        'stopDistance': 0,
        'stopSequence': 0
      }
    })
  }
}

function addTrip(direction, departureHour, departureMinute, headsign) {
  let shapeID = `${ROUTE_GTFS_ID}-mjp-1.1.${direction === 'Down' ? 'H' : 'R'}`
  let tripID = `${utils.pad(departureHour, 2)}${utils.pad(departureMinute, 2)}.${shapeID}`

  module.exports.trips.push({
    'mode': 'bus',
    'routeGTFSID': ROUTE_GTFS_ID,
    'calendarID': 'WEEKDAY',
    'tripID': tripID,
    'gtfsDirection': direction === 'Down' ? '0' : '1',
    'shapeID': shapeID,
    'headsign': headsign
  })

  module.exports.timings.push(generateTripTimes(direction, departureHour * 60 + departureMinute, tripID))
}

module.exports = {
  'days': [
    ['WEEKDAY', '1', '1', '1', '1', '1', '0', '0', '20240715', '20241115']
  ],
  'dates': [
    // ...generateExclusion('WEEKDAY', '20220625', '20220717')
  ],
  'trips': [],
  'timings': []
}

for (let hour = 7; hour <= 18; hour += 1) {
  addTrip('Down', hour, 10, 'Monash University Peninsula')
  addTrip('Up', hour, 10, 'Monash University Clayton')
}
