const utils = require('../../../utils')
const moment = require('moment')

function dateRange(name, start, end, type) {
  let startDate = utils.parseTime(start, 'YYYYMMDD')
  let endDate = utils.parseTime(end, 'YYYYMMDD')

  let allDatesInbetween = utils.allDaysBetweenDates(startDate, endDate)

  return allDatesInbetween.map(date => {
    return [name, date, type]
  })
}

let generateExclusion = (name, start, end) => dateRange(name, start, end, '2')
let generateInclusion = (name, start, end) => dateRange(name, start, end, '1')

module.exports = {
  "days": [
    ["GREEN", "1", "1", "1", "1", "1", "1", "1", "20201226", "20210103"]
  ],
  "dates": [
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "0950.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1140.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1030.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1355.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1130.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1340.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1230.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1435.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1355.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1550.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1520.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1720.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1540.GREEN.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "GREEN",
      "tripID": "1710.GREEN.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    }
  ],
  "timings": [
    {
      "tripID": "0950.GREEN.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "09:50:00",
          "departureTime": "09:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "10:13:00",
          "departureTime": "10:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "10:29:00",
          "departureTime": "10:29:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "10:45:00",
          "departureTime": "11:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000005,
          "arrivalTime": "12:00:00",
          "departureTime": "12:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000006,
          "arrivalTime": "12:25:00",
          "departureTime": "12:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1140.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "11:40:00",
          "departureTime": "11:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "11:55:00",
          "departureTime": "11:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "12:09:00",
          "departureTime": "12:13:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "12:38:00",
          "departureTime": "12:38:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1030.GREEN.13-PBR-mjp-1.1.H",
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
          "departureTime": "11:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "11:15:00",
          "departureTime": "11:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "11:28:00",
          "departureTime": "11:28:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1355.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "13:55:00",
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
          "stopGTFSID": 13000002,
          "arrivalTime": "14:22:00",
          "departureTime": "14:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "14:55:00",
          "departureTime": "14:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1130.GREEN.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "11:30:00",
          "departureTime": "11:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "12:03:00",
          "departureTime": "12:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "12:25:00",
          "departureTime": "12:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "12:40:00",
          "departureTime": "12:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1340.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000006,
          "arrivalTime": "13:40:00",
          "departureTime": "13:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000005,
          "arrivalTime": "14:00:00",
          "departureTime": "14:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:15:00",
          "departureTime": "14:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1230.GREEN.13-PBR-mjp-1.1.H",
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
          "arrivalTime": "13:08:00",
          "departureTime": "13:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "13:26:00",
          "departureTime": "13:26:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "13:41:00",
          "departureTime": "13:41:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1435.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:35:00",
          "departureTime": "14:35:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        // Express thru emerald
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "15:14:00",
          "departureTime": "15:28:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "15:48:00",
          "departureTime": "15:48:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1355.GREEN.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "13:55:00",
          "departureTime": "13:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "14:20:00",
          "departureTime": "14:28:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "14:55:00",
          "departureTime": "14:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "15:10:00",
          "departureTime": "15:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1550.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "13:50:00",
          "departureTime": "13:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "16:05:00",
          "departureTime": "16:05:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:17:00",
          "departureTime": "16:25:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "16:50:00",
          "departureTime": "16:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1520.GREEN.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "15:20:00",
          "departureTime": "15:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000005,
          "arrivalTime": "15:35:00",
          "departureTime": "15:35:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000006,
          "arrivalTime": "16:00:00",
          "departureTime": "16:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1720.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "17:20:00",
          "departureTime": "17:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "17:35:00",
          "departureTime": "17:35:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "17:47:00",
          "departureTime": "17:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "18:16:00",
          "departureTime": "18:16:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1540.GREEN.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "15:40:00",
          "departureTime": "15:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:12:00",
          "departureTime": "16:24:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "16:40:00",
          "departureTime": "16:40:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "16:52:00",
          "departureTime": "16:52:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1710.GREEN.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000006,
          "arrivalTime": "17:10:00",
          "departureTime": "17:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000005,
          "arrivalTime": "17:30:00",
          "departureTime": "17:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "17:45:00",
          "departureTime": "17:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "18:05:00",
          "departureTime": "18:05:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "18:17:00",
          "departureTime": "18:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "18:45:00",
          "departureTime": "18:45:00",
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
