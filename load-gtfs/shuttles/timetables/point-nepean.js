const daylightSavings = require('../../../daylight-savings')
const utils = require('../../../utils')

let baseDownTripTimes = [
  {
    "stopGTFSID": 11844,
    "departureTimeMinutes": -5
  },
  {
    "stopGTFSID": 12000001,
    "departureTimeMinutes": 0
  },
  {
    "stopGTFSID": 12000002,
    "departureTimeMinutes": 3
  },
  {
    "stopGTFSID": 12000003,
    "departureTimeMinutes": 5
  },
  {
    "stopGTFSID": 12000004,
    "departureTimeMinutes": 6
  },
  {
    "stopGTFSID": 12000005,
    "departureTimeMinutes": 7
  }
]

let baseUpTripTimes = [
  {
    "stopGTFSID": 12000005,
    "departureTimeMinutes": 0
  },
  {
    "stopGTFSID": 12000004,
    "departureTimeMinutes": 1
  },
  {
    "stopGTFSID": 12000003,
    "departureTimeMinutes": 2
  },
  {
    "stopGTFSID": 12000002,
    "departureTimeMinutes": 4
  },
  {
    "stopGTFSID": 12000001,
    "departureTimeMinutes": 7
  },
  {
    "stopGTFSID": 11844,
    "departureTimeMinutes": 12
  },
]

function generateTripTimes(direction, departureTime, hasFrontEntrance, tripID) {
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

let baseTrips = [
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1025.EVERYDAY.12-PNS-B-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-B-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1045.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1100.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1115.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1130.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1145.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1200.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1215.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1230.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1245.EVERYDAY.12-PNS-B-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-B-mjp-1.1.R",
    "headsign": "Front Entrance"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1330.EVERYDAY.12-PNS-B-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-B-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1345.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1400.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1415.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1430.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1445.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1500.EVERYDAY.12-PNS-A-mjp-1.1.H",
    "gtfsDirection": "0",
    "shapeID": "12-PNS-A-mjp-1.1.H",
    "headsign": "Fort Nepean"
  },
  {
    "mode": "bus",
    "routeGTFSID": "12-PNS",
    "calendarID": "EVERYDAY",
    "tripID": "1515.EVERYDAY.12-PNS-A-mjp-1.1.R",
    "gtfsDirection": "1",
    "shapeID": "12-PNS-A-mjp-1.1.R",
    "headsign": "Quarantine Station"
  }
]

let dstLast = [{
  "mode": "bus",
  "routeGTFSID": "12-PNS",
  "calendarID": "%",
  "tripID": "1615.%.12-PNS-A-mjp-1.1.H",
  "gtfsDirection": "0",
  "shapeID": "12-PNS-A-mjp-1.1.H",
  "headsign": "Fort Nepean"
}, {
  "mode": "bus",
  "routeGTFSID": "12-PNS",
  "calendarID": "%",
  "tripID": "1630.%.12-PNS-B-mjp-1.1.R",
  "gtfsDirection": "1",
  "shapeID": "12-PNS-B-mjp-1.1.R",
  "headsign": "Front Entrance"
}]

let nonDSTLast = [{
  "mode": "bus",
  "routeGTFSID": "12-PNS",
  "calendarID": "%",
  "tripID": "1530.%.12-PNS-A-mjp-1.1.H",
  "gtfsDirection": "0",
  "shapeID": "12-PNS-A-mjp-1.1.H",
  "headsign": "Fort Nepean"
}, {
  "mode": "bus",
  "routeGTFSID": "12-PNS",
  "calendarID": "%",
  "tripID": "1600.%.12-PNS-B-mjp-1.1.R",
  "gtfsDirection": "1",
  "shapeID": "12-PNS-B-mjp-1.1.R",
  "headsign": "Front Entrance"
}]

let everydayBase = ["1", "1", "1", "1", "1", "1", "1"]

let dstBlocks = daylightSavings.filter(block => block.isDST).map((block, i) => {
  return [`EVERYDAY_DST_${String.fromCharCode(65 + i)}`, ...everydayBase, block.start, block.end]
})

let nonDSTBlocks = daylightSavings.filter(block => !block.isDST).map((block, i) => {
  return [`EVERYDAY_NONDST_${String.fromCharCode(65 + i)}`, ...everydayBase, block.start, block.end]
})

let everydayBlock = ['EVERYDAY', ...everydayBase, daylightSavings[0].start, daylightSavings.slice(-1)[0].end]

let dstLastTrips = dstBlocks.map(block => {
  return dstLast.map(trip => ({
    ...trip,
    calendarID: block[0],
    tripID: trip.tripID.replace('%', block[0])
  }))
}).reduce((a, b) => a.concat(b), [])

let nonDSTLastTrips = nonDSTBlocks.map(block => {
  return nonDSTLast.map(trip => ({
    ...trip,
    calendarID: block[0],
    tripID: trip.tripID.replace('%', block[0])
  }))
}).reduce((a, b) => a.concat(b), [])

let dstLastTripTimes = dstBlocks.map(block => {
  return [
    generateTripTimes('Down', 16 * 60 + 15, false, dstLast[0].tripID.replace('%', block[0])),
    generateTripTimes('Up', 16 * 60 + 30, true, dstLast[1].tripID.replace('%', block[0]))
  ]
}).reduce((a, b) => a.concat(b), [])

let nonDSTLastTripTimes = nonDSTBlocks.map(block => {
  return [
    generateTripTimes('Down', 15 * 60 + 30, false, nonDSTLast[0].tripID.replace('%', block[0])),
    generateTripTimes('Up', 16 * 60 + 0, true, nonDSTLast[1].tripID.replace('%', block[0]))
  ]
}).reduce((a, b) => a.concat(b), [])

module.exports = {
  "days": [
    ...dstBlocks,
    ...nonDSTBlocks,
    everydayBlock
  ],
  "dates": [],
  "trips": [
    ...baseTrips,
    ...dstLastTrips,
    ...nonDSTLastTrips
  ],
  "timings": [
    generateTripTimes('Down', 10 * 60 + 30, true, '1025.EVERYDAY.12-PNS-B-mjp-1.1.H'),
    generateTripTimes('Up', 10 * 60 + 45, false, '1045.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 11 * 60 + 0, false, '1100.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 11 * 60 + 15, false, '1115.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 11 * 60 + 30, false, '1130.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 11 * 60 + 45, false, '1145.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 12 * 60 + 0, false, '1200.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 12 * 60 + 15, false, '1215.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 12 * 60 + 30, false, '1230.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 12 * 60 + 45, true, '1245.EVERYDAY.12-PNS-B-mjp-1.1.R'),
    generateTripTimes('Down', 13 * 60 + 35, true, '1330.EVERYDAY.12-PNS-B-mjp-1.1.H'),
    generateTripTimes('Up', 13 * 60 + 45, false, '1345.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 14 * 60 + 0, false, '1400.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 14 * 60 + 15, false, '1415.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 14 * 60 + 30, false, '1430.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 14 * 60 + 45, false, '1445.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    generateTripTimes('Down', 15 * 60 + 0, false, '1500.EVERYDAY.12-PNS-A-mjp-1.1.H'),
    generateTripTimes('Up', 15 * 60 + 15, false, '1515.EVERYDAY.12-PNS-A-mjp-1.1.R'),
    ...dstLastTripTimes,
    ...nonDSTLastTripTimes
  ]
}
