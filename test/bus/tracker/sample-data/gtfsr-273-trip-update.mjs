export default {
  header: {
    gtfs_realtime_version: '2.0',
    incrementality: 0,
    timestamp: 1761357975,
    feed_version: ''
  },
  entity: [
    {
      id: '14-273--1-MF34-273031',
      is_deleted: false,
      trip_update: {
        trip: {
          trip_id: '14-273--1-MF34-273031',
          route_id: 'vic:14273:_:R:aus',
          direction_id: 0,
          start_time: '12:45:00',
          start_date: '20251231',
          schedule_relationship: 0,
          modified_trip: undefined
        },
        vehicle: undefined,
        stop_time_update: [
          {
            stop_sequence: 4,
            stop_id: '4105',
            arrival: {
              delay: 0,
              time: 1767145632,
              uncertainty: 0,
              scheduled_time: 0
            },
            departure: {
              delay: 0,
              time: 1767145632,
              uncertainty: 0,
              scheduled_time: 0
            },
            departure_occupancy_status: 0,
            schedule_relationship: 0,
            stop_time_properties: undefined
          },
          {
            stop_sequence: 5,
            stop_id: '4106',
            arrival: {
              delay: 0,
              time: 1767145692,
              uncertainty: 0,
              scheduled_time: 0
            },
            departure: {
              delay: 0,
              time: 1767145740,
              uncertainty: 0,
              scheduled_time: 0
            },
            departure_occupancy_status: 0,
            schedule_relationship: 0,
            stop_time_properties: undefined
          }
        ],
        timestamp: 0,
        delay: 0,
        trip_properties: undefined
      },
      vehicle: undefined,
      alert: undefined,
      shape: undefined,
      stop: undefined,
      trip_modifications: undefined
    }
  ]
}