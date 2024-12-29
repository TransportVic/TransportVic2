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
    ["PURPLE", "1", "1", "1", "1", "1", "0", "0", "20200414", "20200918"]
  ],
  "dates": [
    ["PURPLE", "20200503", "2"],
    ...generateExclusion("PURPLE", "20200701", "20200712")
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "PURPLE",
      "tripID": "1030.PURPLE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "PURPLE",
      "tripID": "1215.PURPLE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "PURPLE",
      "tripID": "1215.PURPLE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "PURPLE",
      "tripID": "1400.PURPLE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "PURPLE",
      "tripID": "1400.PURPLE.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "PURPLE",
      "tripID": "1540.PURPLE.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Belgrave"
    }
  ],
  "timings": [
    {
      "tripID": "1030.PURPLE.13-PBR-mjp-1.1.H",
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
      "tripID": "1215.PURPLE.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "12:15:00",
          "departureTime": "10:15:00",
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
          "stopGTFSID": 13000002,
          "arrivalTime": "12:43:00",
          "departureTime": "12:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "13:15:00",
          "departureTime": "13:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1215.PURPLE.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
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
          "arrivalTime": "12:45:00",
          "departureTime": "12:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000003,
          "arrivalTime": "13:10:00",
          "departureTime": "13:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "13:20:00",
          "departureTime": "13:20:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1400.PURPLE.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:00:00",
          "departureTime": "14:00:00",
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
          "arrivalTime": "14:28:00",
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
      "tripID": "1400.PURPLE.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "14:00:00",
          "departureTime": "14:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "14:23:00",
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
          "stopGTFSID": 13000004,
          "arrivalTime": "15:00:00",
          "departureTime": "15:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1540.PURPLE.13-PBR-mjp-1.1.R",
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
          "arrivalTime": "15:50:00",
          "departureTime": "16:07:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "16:08:00",
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
    }
  ]
}
