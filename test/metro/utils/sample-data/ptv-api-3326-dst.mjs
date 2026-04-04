export default {
  "disruptions": [],
  "departures": [
    {
      "skipped_stops": [],
      "stop_id": 1115,
      "route_id": 9,
      "run_id": 951326,
      "run_ref": "951326",
      "direction_id": 1,
      "disruption_ids": [
        344824,
        323905
      ],
      "scheduled_departure_utc": "2026-04-04T16:48:00Z",
      "estimated_departure_utc": null,
      "at_platform": false,
      "platform_number": "1",
      "flags": "",
      "departure_sequence": 1,
      "departure_note": ""
    },
    {
      "skipped_stops": [],
      "stop_id": 1133,
      "route_id": 9,
      "run_id": 951326,
      "run_ref": "951326",
      "direction_id": 1,
      "disruption_ids": [
        344824,
        323905
      ],
      "scheduled_departure_utc": "2026-04-04T16:53:00Z",
      "estimated_departure_utc": null,
      "at_platform": false,
      "platform_number": "1",
      "flags": "",
      "departure_sequence": 2,
      "departure_note": ""
    },
    {
      "skipped_stops": [],
      "stop_id": 1048,
      "route_id": 9,
      "run_id": 951326,
      "run_ref": "951326",
      "direction_id": 1,
      "disruption_ids": [
        344824,
        323905
      ],
      "scheduled_departure_utc": "2026-04-04T16:57:00Z",
      "estimated_departure_utc": null,
      "at_platform": false,
      "platform_number": "1",
      "flags": "",
      "departure_sequence": 3,
      "departure_note": ""
    },
    {
      "skipped_stops": [],
      "stop_id": 1164,
      "route_id": 9,
      "run_id": 951326,
      "run_ref": "951326",
      "direction_id": 1,
      "disruption_ids": [
        344824,
        323905
      ],
      "scheduled_departure_utc": "2026-04-04T17:01:00Z",
      "estimated_departure_utc": null,
      "at_platform": false,
      "platform_number": "1",
      "flags": "",
      "departure_sequence": 4,
      "departure_note": ""
    },
    {
      "skipped_stops": [],
      "stop_id": 1163,
      "route_id": 9,
      "run_id": 951326,
      "run_ref": "951326",
      "direction_id": 1,
      "disruption_ids": [
        344824,
        323905
      ],
      "scheduled_departure_utc": "2026-04-04T17:04:00Z",
      "estimated_departure_utc": null,
      "at_platform": false,
      "platform_number": "1",
      "flags": "E",
      "departure_sequence": 5,
      "departure_note": ""
    }
  ],
  "stops": {
    "1048": {
      "stop_ticket": {
        "ticket_type": "",
        "zone": "Zone 2",
        "is_free_fare_zone": false,
        "ticket_machine": true,
        "ticket_checks": true,
        "vline_reservation": false,
        "ticket_zones": [
          2
        ]
      },
      "stop_distance": 0.0,
      "stop_suburb": "Croydon",
      "stop_name": "Croydon",
      "stop_id": 1048,
      "route_type": 0,
      "stop_latitude": -37.79544,
      "stop_longitude": 145.2806,
      "stop_landmark": "",
      "stop_sequence": 0
    },
    "1115": {
      "stop_ticket": {
        "ticket_type": "",
        "zone": "Zone 2",
        "is_free_fare_zone": false,
        "ticket_machine": false,
        "ticket_checks": true,
        "vline_reservation": false,
        "ticket_zones": [
          2
        ]
      },
      "stop_distance": 0.0,
      "stop_suburb": "Lilydale",
      "stop_name": "Lilydale",
      "stop_id": 1115,
      "route_type": 0,
      "stop_latitude": -37.7555161,
      "stop_longitude": 145.347717,
      "stop_landmark": "",
      "stop_sequence": 0
    },
    "1133": {
      "stop_ticket": {
        "ticket_type": "",
        "zone": "Zone 2",
        "is_free_fare_zone": false,
        "ticket_machine": true,
        "ticket_checks": false,
        "vline_reservation": false,
        "ticket_zones": [
          2
        ]
      },
      "stop_distance": 0.0,
      "stop_suburb": "Mooroolbark",
      "stop_name": "Mooroolbark",
      "stop_id": 1133,
      "route_type": 0,
      "stop_latitude": -37.7847481,
      "stop_longitude": 145.312408,
      "stop_landmark": "",
      "stop_sequence": 0
    },
    "1163": {
      "stop_ticket": {
        "ticket_type": "",
        "zone": "Zone 2",
        "is_free_fare_zone": false,
        "ticket_machine": false,
        "ticket_checks": false,
        "vline_reservation": false,
        "ticket_zones": [
          2
        ]
      },
      "stop_distance": 0.0,
      "stop_suburb": "Ringwood",
      "stop_name": "Ringwood",
      "stop_id": 1163,
      "route_type": 0,
      "stop_latitude": -37.81589,
      "stop_longitude": 145.228973,
      "stop_landmark": "",
      "stop_sequence": 0
    },
    "1164": {
      "stop_ticket": {
        "ticket_type": "",
        "zone": "Zone 2",
        "is_free_fare_zone": false,
        "ticket_machine": false,
        "ticket_checks": false,
        "vline_reservation": false,
        "ticket_zones": [
          2
        ]
      },
      "stop_distance": 0.0,
      "stop_suburb": "Ringwood East",
      "stop_name": "Ringwood East",
      "stop_id": 1164,
      "route_type": 0,
      "stop_latitude": -37.81197,
      "stop_longitude": 145.2502,
      "stop_landmark": "",
      "stop_sequence": 0
    }
  },
  "routes": {
    "9": {
      "route_type": 0,
      "route_id": 9,
      "route_name": "Lilydale",
      "route_number": "",
      "route_gtfs_id": "2-LIL",
      "geopath": []
    }
  },
  "runs": {
    "951326": {
      "run_id": 951326,
      "run_ref": "951326",
      "route_id": 9,
      "route_type": 0,
      "final_stop_id": 1163,
      "destination_name": "Ringwood",
      "status": "scheduled",
      "direction_id": 1,
      "run_sequence": 0,
      "express_stop_count": 0,
      "vehicle_position": null,
      "vehicle_descriptor": null,
      "geopath": [],
      "interchange": {
        "feeder": {
          "run_ref": "951331",
          "route_id": 9,
          "stop_id": 1115,
          "advertised": false,
          "direction_id": 8,
          "destination_name": "Lilydale"
        },
        "distributor": {
          "run_ref": "955297",
          "route_id": 2,
          "stop_id": 1018,
          "advertised": false,
          "direction_id": 2,
          "destination_name": "Belgrave"
        }
      },
      "run_note": "",
      "externalService": null
    }
  },
  "directions": {
    "1": {
      "direction_id": 1,
      "direction_name": "City",
      "route_id": 9,
      "route_type": 0
    }
  },
  "status": {
    "version": "3.0",
    "health": 1
  }
}