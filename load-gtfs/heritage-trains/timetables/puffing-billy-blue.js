const utils = require('../../../utils')
const moment = require('moment')

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

module.exports = {
  "days": [
    ["BLUE", "0", "0", "0", "0", "0", "1", "1", "20200222", "20200322"]
  ],
  "dates": [
    ["BLUE", "20200307", "2"],
    ["BLUE", "20200308", "2"],

    ["BLUE", "20201024", "1"],
    ["BLUE", "20201025", "1"],

    ["BLUE", "20201107", "1"],
    ["BLUE", "20201108", "1"],
    ["BLUE", "20201114", "1"],
    ["BLUE", "20201115", "1"],
    ["BLUE", "20201121", "1"],
    ["BLUE", "20201122", "1"],
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1030.BLUE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1230.BLUE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1110.BLUE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1425.BLUE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1230.BLUE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1540.BLUE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1430.BLUE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BLUE",
      "tripID": "1615.BLUE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
  ],
  "timings": [
    {
      "tripID": "1030.BLUE.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "10:30:00",
          "departureTime": "10:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "10:53:00",
          "departureTime": "11:05:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "11:20:00",
          "departureTime": "11:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "11:30:00",
          "departureTime": "11:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1230.BLUE.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "12:30:00",
          "departureTime": "10:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "12:45:00",
          "departureTime": "12:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "12:57:00",
          "departureTime": "13:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "13:30:00",
          "departureTime": "13:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1110.BLUE.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "11:10:00",
          "departureTime": "11:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "11:33:00",
          "departureTime": "11:38:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "11:51:00",
          "departureTime": "11:51:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "12:00:00",
          "departureTime": "12:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1425.BLUE.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:25:00",
          "departureTime": "14:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "14:40:00",
          "departureTime": "14:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "14:57:00",
          "departureTime": "15:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "15:30:00",
          "departureTime": "15:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1230.BLUE.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "12:30:00",
          "departureTime": "12:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "12:59:00",
          "departureTime": "13:05:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "13:20:00",
          "departureTime": "13:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "13:40:00",
          "departureTime": "13:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1540.BLUE.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "15:40:00",
          "departureTime": "15:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "15:55:00",
          "departureTime": "15:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:07:00",
          "departureTime": "16:08:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "16:32:00",
          "departureTime": "16:32:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1430.BLUE.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "14:30:00",
          "departureTime": "14:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "14:53:00",
          "departureTime": "15:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "15:15:00",
          "departureTime": "15:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "15:30:00",
          "departureTime": "15:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1615.BLUE.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "16:15:00",
          "departureTime": "16:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "16:25:00",
          "departureTime": "16:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:37:00",
          "departureTime": "16:38:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "15:08:00",
          "departureTime": "15:08:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    }
  ]
}
