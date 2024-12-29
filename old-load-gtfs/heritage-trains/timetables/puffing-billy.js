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
    ["BEG_L", "0", "0", "0", "0", "1", "1", "1", "20210201", "20210430"],
    ["BEG_L_10", "1", "1", "1", "1", "1", "1", "1", "20210401", "20210401"],
    ["BEG_M", "0", "0", "0", "0", "1", "1", "1", "20210201", "20210430"],
    ["BEG_G", "0", "0", "0", "0", "0", "1", "1", "20210116", "20210430"]
  ],
  "dates": [
    ...generateInclusion('BEG_L', '20201219', '20210131'),
    ...generateInclusion('BEG_L', '20210215', '20210219'),
    ['BEG_L', '20210308', '1'],
    ...generateInclusion('BEG_L', '20210402', '20210418'),

    ['BEG_L_10', '20210511', '1'],

    ...generateInclusion('BEG_M', '20201219', '20210131'),
    ...generateInclusion('BEG_M', '20210215', '20210219'),
    ['BEG_M', '20210308', '1'],
    ...generateInclusion('BEG_M', '20210402', '20210418'),

    ...generateInclusion('BEG_G', '20210402', '20210418'),
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_L",
      "tripID": "1000.BEG_L.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Lakeside"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_L",
      "tripID": "1230.BEG_L.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_L",
      "tripID": "1230.BEG_L.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Lakeside"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_L",
      "tripID": "1445.BEG_L.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },


    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_L_10",
      "tripID": "1000.BEG_L_10.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Lakeside"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_L_10",
      "tripID": "1230.BEG_L_10.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },

    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_M",
      "tripID": "1000.BEG_M.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Menzies Creek"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_M",
      "tripID": "1130.BEG_M.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },

    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_G",
      "tripID": "1100.BEG_G.13-PBR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.H",
      "headsign": "Gembrook"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-PBR",
      "calendarID": "BEG_G",
      "tripID": "1445.BEG_G.13-PBR-mjp-1.1.R",
      "gtfsDirection": "0",
      "shapeID": "13-PBR-mjp-1.1.R",
      "headsign": "Belgrave"
    },
  ],
  "timings": [
    {
      "tripID": "1000.BEG_L.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "10:00:00",
          "departureTime": "10:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "11:00:00",
          "departureTime": "11:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1230.BEG_L.13-PBR-mjp-1.1.R",
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
      "tripID": "1230.BEG_L.13-PBR-mjp-1.1.H",
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
      "tripID": "1445.BEG_L.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "14:45:00",
          "departureTime": "14:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "15:35:00",
          "departureTime": "15:35:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },

    {
      "tripID": "1000.BEG_L_10.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "10:00:00",
          "departureTime": "10:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
          "arrivalTime": "11:00:00",
          "departureTime": "11:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1230.BEG_L_10.13-PBR-mjp-1.1.R",
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
      "tripID": "1000.BEG_M.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "10:00:00",
          "departureTime": "10:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "10:30:00",
          "departureTime": "10:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1130.BEG_M.13-PBR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000002,
          "arrivalTime": "11:30:00",
          "departureTime": "11:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "11:50:00",
          "departureTime": "11:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },

    {
      "tripID": "1100.BEG_G.13-PBR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000001,
          "arrivalTime": "11:00:00",
          "departureTime": "11:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000004,
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
      "tripID": "1445.BEG_G.13-PBR-mjp-1.1.R",
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
  ]
}
