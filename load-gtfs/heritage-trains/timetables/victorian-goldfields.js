module.exports = {
  "days": [
    // Blue is steam, red is diesel, timewise there is no diff
    ["SUN_BLUE_RED", "0", "0", "1", "0", "0", "0", "1", "20210207", "20210428"],
    ["SAT_ALES", "0", "0", "0", "0", "0", "1", "0", "20210320", "20210320"]
  ],
  "dates": [
    ["SUN_BLUE_RED", "20210210", "2"],
    ["SUN_BLUE_RED", "20210217", "2"],
    ["SUN_BLUE_RED", "20210224", "2"],

    ["SUN_BLUE_RED", "20210308", "1"],
    ["SUN_BLUE_RED", "20210331", "2"],

    ["SUN_BLUE_RED", "20210403", "1"],
    ["SUN_BLUE_RED", "20210405", "1"],
    ["SUN_BLUE_RED", "20210410", "1"],
    ["SUN_BLUE_RED", "20210417", "1"],

    ["SAT_ALES", "20210424", "1"],
    ["SAT_ALES", "20210529", "1"],
    ["SAT_ALES", "20210619", "1"],
    ["SAT_ALES", "20210717", "1"],
    ["SAT_ALES", "20210814", "1"],
    ["SAT_ALES", "20210911", "1"],
    ["SAT_ALES", "20211009", "1"],
    ["SAT_ALES", "20211113", "1"]
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "SUN_BLUE_RED",
      "tripID": "1130.SUN_BLUE_RED.13-VGR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-VGR-mjp-1.1.H",
      "headsign": "Maldon"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "SUN_BLUE_RED",
      "tripID": "1445.SUN_BLUE_RED.13-VGR-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "13-VGR-mjp-1.1.R",
      "headsign": "Castlemaine"
    },

    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "SAT_ALES",
      "tripID": "1130.SAT_ALES.13-VGR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-VGR-mjp-1.1.H",
      "headsign": "Maldon"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "SAT_ALES",
      "tripID": "1530.SAT_ALES.13-VGR-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "13-VGR-mjp-1.1.R",
      "headsign": "Castlemaine"
    }
  ],
  "timings": [
    {
      "tripID": "1130.SUN_BLUE_RED.13-VGR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000012,
          "arrivalTime": "11:30:00",
          "departureTime": "11:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000029,
          "arrivalTime": "11:55:00",
          "departureTime": "11:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "12:15:00",
          "departureTime": "12:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1445.SUN_BLUE_RED.13-VGR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "14:45:00",
          "departureTime": "14:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000029,
          "arrivalTime": "15:10:00",
          "departureTime": "15:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000012,
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
      "tripID": "1130.SAT_ALES.13-VGR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000012,
          "arrivalTime": "11:30:00",
          "departureTime": "11:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000029,
          "arrivalTime": "11:55:00",
          "departureTime": "11:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "12:15:00",
          "departureTime": "12:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1530.SAT_ALES.13-VGR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "15:30:00",
          "departureTime": "15:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000029,
          "arrivalTime": "15:55:00",
          "departureTime": "15:55:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000012,
          "arrivalTime": "16:15:00",
          "departureTime": "16:15:00",
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

let old = {
  "days": [
    ["WED_SUN", "0", "0", "1", "0", "0", "0", "1", "20200101", "20201231"]
  ],
  "dates": [
    ["WED_SUN", "20200205", "2"],
    ["WED_SUN", "20200212", "2"],
    ["WED_SUN", "20200219", "2"],
    ["WED_SUN", "20200226", "2"],

    ["WED_SUN", "20212203", "2"],
    ["WED_SUN", "20212210", "2"],
    ["WED_SUN", "20212217", "2"],
    ["WED_SUN", "20212224", "2"]
  ],
  "trips": [
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "WED_SUN",
      "tripID": "1030.WED_SUN.13-VGR-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "13-VGR-mjp-1.1.R",
      "headsign": "Castlemaine"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "WED_SUN",
      "tripID": "1200.WED_SUN.13-VGR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-VGR-mjp-1.1.H",
      "headsign": "Maldon"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "WED_SUN",
      "tripID": "1445.WED_SUN.13-VGR-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "13-VGR-mjp-1.1.R",
      "headsign": "Castlemaine"
    },
    {
      "mode": "heritage train",
      "routeGTFSID": "13-VGR",
      "calendarID": "WED_SUN",
      "tripID": "1600.WED_SUN.13-VGR-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "13-VGR-mjp-1.1.H",
      "headsign": "Maldon"
    }
  ],
  "timings": [
    {
      "tripID": "1030.WED_SUN.13-VGR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "10:30:00",
          "departureTime": "10:30:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000012,
          "arrivalTime": "11:15:00",
          "departureTime": "11:15:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1200.WED_SUN.13-VGR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000012,
          "arrivalTime": "12:00:00",
          "departureTime": "12:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "12:45:00",
          "departureTime": "12:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1445.WED_SUN.13-VGR-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "14:45:00",
          "departureTime": "14:45:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000012,
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
      "tripID": "1600.WED_SUN.13-VGR-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 13000012,
          "arrivalTime": "16:00:00",
          "departureTime": "16:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 13000011,
          "arrivalTime": "16:45:00",
          "departureTime": "16:45:00",
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
