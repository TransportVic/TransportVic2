export default {
  "departures": [
    {
      "stop_id": 1162,
      "route_id": 11,
      "run_id": 967014,
      "run_ref": "967014",
      "direction_id": 1,
      "disruption_ids": [],
      "scheduled_departure_utc": "2026-01-30T23:22:00.000Z",
      "estimated_departure_utc": "2026-01-30T23:22:00.000Z",
      "at_platform": false,
      "platform_number": "5",
      "flags": "",
      "departure_sequence": 0,
      "departure_note": ""
    }
  ],
  "stops": {
    "1162": {
      "stop_distance": 0.0,
      "stop_suburb": "Richmond",
      "stop_name": "Richmond",
      "stop_id": 1162,
      "route_type": 0,
      "stop_latitude": -37.8240738,
      "stop_longitude": 144.990158,
      "stop_landmark": "",
      "stop_sequence": 0
    }
  },
  "routes": {
    "4": {
      "route_type": 0,
      "route_id": 4,
      "route_name": "Cranbourne",
      "route_number": "",
      "route_gtfs_id": "2-CBE",
      "geopath": []
    },
    "11": {
      "route_type": 0,
      "route_id": 11,
      "route_name": "Pakenham",
      "route_number": "",
      "route_gtfs_id": "2-PKM",
      "geopath": []
    }
  },
  "runs": {
    "967014": {
      "run_id": 967014,
      "run_ref": "967014",
      "route_id": 11,
      "route_type": 0,
      "final_stop_id": 1071,
      "destination_name": "Flinders Street",
      "status": "scheduled",
      "direction_id": 1,
      "run_sequence": 0,
      "express_stop_count": 0,
      "vehicle_position": {
        "latitude": -37.917061065375655,
        "longitude": 145.11039278030736,
        "easting": 333903.41965864407,
        "northing": 5801703.694345424,
        "direction": "Inbound",
        "bearing": -46.86228404084688,
        "supplier": "CIS - Metro Trains Melbourne",
        "datetime_utc": "2026-01-31T10:49:56",
        "expiry_time": "2026-01-31T10:50:30"
      },
      "vehicle_descriptor": {
        "operator": "Metro Trains Melbourne",
        "id": "9040M-9940M",
        "low_floor": null,
        "air_conditioned": null,
        "description": "3 Car Silver Hitachi",
        "supplier": "CIS - Metro Trains Melbourne",
        "length": "160"
      },
      "geopath": [],
      "interchange": {
        "feeder": null,
        "distributor": {
          "run_ref": "967025",
          "route_id": 11,
          "stop_id": 1230,
          "advertised": false,
          "direction_id": 10,
          "destination_name": "East Pakenham"
        }
      },
      "run_note": "",
      "externalService": 7
    }
  },
  "directions": {
    "1": {
      "direction_id": 1,
      "direction_name": "City",
      "route_id": 6,
      "route_type": 0
    }
  },
  "disruptions": {},
  "status": {
    "version": "3.0",
    "health": 1
  }
}