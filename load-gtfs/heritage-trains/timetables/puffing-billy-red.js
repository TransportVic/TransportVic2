const utils = require('../../../utils')
const moment = require('moment')

function dateRange(name, start, end, type) {
  let startDate = moment.tz(start, 'YYYYMMDD', 'Australia/Melbourne')
  let endDate = moment.tz(end, 'YYYYMMDD', 'Australia/Melbourne')

  let allDatesInbetween = utils.allDaysBetweenDates(startDate, endDate)

  return allDatesInbetween.map(date => {
    return [name, date, type]
  })
}

let generateExclusion = (name, start, end) => dateRange(name, start, end, '2')
let generateInclusion = (name, start, end) => dateRange(name, start, end, '1')

module.exports = {
  "days": [
    ["RED", "1", "1", "1", "1", "1", "1", "1", "20200410", "20200413"]
  ],
  "dates": [
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1030.RED.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1230.RED.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1110.RED.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1430.RED.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1230.RED.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1445.RED.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1315.RED.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1620.RED.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1430.RED.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "RED",
      "tripID": "1700.RED.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    }
  ],
  "timings": [
    {
      "tripID": "1030.RED.13-PBR-mjp-1.1.H",
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
      "tripID": "1230.RED.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "12:30:00",
          "departureTime": "12:30:00",
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
          "arrivalTime": "13:25:00",
          "departureTime": "13:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1110.RED.13-PBR-mjp-1.1.H",
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
          "arrivalTime": "11:53:00",
          "departureTime": "11:53:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "12:08:00",
          "departureTime": "12:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000005,
          "arrivalTime": "12:35:00",
          "departureTime": "12:35:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000006,
          "arrivalTime": "13:00:00",
          "departureTime": "13:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1430.RED.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:30:00",
          "departureTime": "14:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "14:45:00",
          "departureTime": "14:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "14:03:00",
          "departureTime": "15:05:00",
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
      "tripID": "1230.RED.13-PBR-mjp-1.1.H",
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
          "arrivalTime": "13:15:00",
          "departureTime": "13:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
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
      "tripID": "1445.RED.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000006,
          "arrivalTime": "14:45:00",
          "departureTime": "14:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000005,
          "arrivalTime": "15:05:00",
          "departureTime": "15:05:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "15:20:00",
          "departureTime": "15:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "16:00:00",
          "departureTime": "16:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:12:00",
          "departureTime": "16:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "16:40:00",
          "departureTime": "16:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1315.RED.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "13:15:00",
          "departureTime": "13:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "13:47:00",
          "departureTime": "13:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "14:10:00",
          "departureTime": "14:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:20:00",
          "departureTime": "14:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1620.RED.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "16:20:00",
          "departureTime": "16:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "16:30:00",
          "departureTime": "16:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:42:00",
          "departureTime": "16:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "17:10:00",
          "departureTime": "17:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1430.RED.13-PBR-mjp-1.1.H",
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
          "departureTime": "15:05:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "15:23:00",
          "departureTime": "15:23:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "15:33:00",
          "departureTime": "15:33:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1700.RED.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "17:00:00",
          "departureTime": "17:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "17:10:00",
          "departureTime": "17:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "17:22:00",
          "departureTime": "17:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "17:50:00",
          "departureTime": "17:50:00",
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
