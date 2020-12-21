module.exports = {
  "days": [
    ["WEEKDAY", "1", "1", "1", "1", "1", "0", "0", "20201005", "20201204"]
  ],
  "dates": [],
  "trips": [
    {
      "mode": "bus",
      "routeGTFSID": "12-MCP",
      "calendarID": "WEEKDAY",
      "tripID": "0810.WEEKDAY.12-MCP-mjp-1.1.H",
      "gtfsDirection": "0",
      "shapeID": "12-MCP-mjp-1.1.H",
      "headsign": "Monash University Peninsula"
    },
    {
      "mode": "bus",
      "routeGTFSID": "12-MCP",
      "calendarID": "WEEKDAY",
      "tripID": "1700.WEEKDAY.12-MCP-mjp-1.1.R",
      "gtfsDirection": "1",
      "shapeID": "12-MCP-mjp-1.1.R",
      "headsign": "Monash University Clayton"
    }
  ],
  "timings": [
    {
      "tripID": "0810.WEEKDAY.12-MCP-mjp-1.1.H",
      "stopTimings": [
        {
          "stopGTFSID": 48473,
          "arrivalTime": "08:10:00",
          "departureTime": "08:10:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 48017,
          "arrivalTime": "08:50:00",
          "departureTime": "08:50:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        }
      ]
    },
    {
      "tripID": "1700.WEEKDAY.12-MCP-mjp-1.1.R",
      "stopTimings": [
        {
          "stopGTFSID": 48017,
          "arrivalTime": "17:00:00",
          "departureTime": "17:00:00",
          "stopConditions": {
            "dropoff": 0, "pickup": 0
          },
          "stopDistance": 0,
          "stopSequence": 0
        },
        {
          "stopGTFSID": 48473,
          "arrivalTime": "17:40:00",
          "departureTime": "17:40:00",
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
