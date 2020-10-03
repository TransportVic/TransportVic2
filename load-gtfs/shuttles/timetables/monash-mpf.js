const utils = require('../../../utils')

let baseDownTripTimes = [
  {
    "stopGTFSID": 21215,
    "departureTimeMinutes": 0
  },
  {
    "stopGTFSID": 48017,
    "departureTimeMinutes": 10
  }
]

let baseUpTripTimes = [
  {
    "stopGTFSID": 48017,
    "departureTimeMinutes": 0
  },
  {
    "stopGTFSID": 21215,
    "departureTimeMinutes": 10
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

module.exports = {
  "days": [
    ["WEEKDAY", "1", "1", "1", "1", "1", "0", "0", "20200803", "20201120"]
  ],
  "dates": [],
  "trips": [
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0745.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0830.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0900.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0930.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1000.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1040.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1510.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1540.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1610.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1640.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1710.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1740.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1800.WEEKDAY.12-MPF-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MPF-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },

    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0810.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0850.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0920.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "0950.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1030.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1500.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1530.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1600.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1630.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1700.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1730.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1750.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MPF",
      "calendarID": "WEEKDAY",
      "tripID": "1810.WEEKDAY.12-MPF-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MPF-mjp-1.1.R",
      "headsign": "Frankston Railway Station"
    },
  ],
  "timings": [
    generateTripTimes('Down', 7 * 60 + 45, '0745.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 8 * 60 + 30, '0830.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 9 * 60 + 0, '0900.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 9 * 60 + 30, '0930.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 10 * 60 + 0, '1000.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 10 * 60 + 40, '1040.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 15 * 60 + 10, '1510.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 15 * 60 + 40, '1540.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 16 * 60 + 10, '1610.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 16 * 60 + 40, '1640.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 17 * 60 + 10, '1710.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 17 * 60 + 40, '1740.WEEKDAY.12-MPF-mjp-1.1.H'),
    generateTripTimes('Down', 18 * 60 + 0, '1800.WEEKDAY.12-MPF-mjp-1.1.H'),

    generateTripTimes('Up', 8 * 60 + 10, '0810.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 8 * 60 + 50, '0850.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 9 * 60 + 20, '0920.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 9 * 60 + 50, '0950.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 10 * 60 + 30, '1030.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 15 * 60 + 0, '1500.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 15 * 60 + 30, '1530.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 16 * 60 + 0, '1600.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 16 * 60 + 30, '1630.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 17 * 60 + 0, '1700.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 17 * 60 + 30, '1730.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 17 * 60 + 50, '1750.WEEKDAY.12-MPF-mjp-1.1.R'),
    generateTripTimes('Up', 18 * 60 + 10, '1810.WEEKDAY.12-MPF-mjp-1.1.R'),
  ]
}
