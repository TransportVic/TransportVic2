export default {
  header: {
    gtfs_realtime_version: '2.0',
    incrementality: 0,
    timestamp: 1757830372,
    feed_version: ''
  },
  entity: [{
    id: 'RPIDS.TU.20250914.01-TRN--5-T3-8431',
    is_deleted: false,
    trip_update: {
      trip: {
        trip_id: '01-TRN--5-T3-8431',
        route_id: 'aus:vic:vic-01-TRN:',
        direction_id: 0,
        start_time: '15:03:00',
        start_date: '20250914',
        schedule_relationship: 0,
        modified_trip: undefined
      },
      vehicle: {
        id: '8431',
        label: 'VLocity',
        license_plate: '',
        wheelchair_accessible: 0
      },
      stop_time_update: [{
        stop_sequence: 11,
        stop_id: 'G1512-P1',
        arrival: {
          delay: 29,
          time: 1757831189,
          uncertainty: 0,
          scheduled_time: 0
        },
        departure: {
          delay: 29,
          time: 1757831189,
          uncertainty: 0,
          scheduled_time: 0
        },
        departure_occupancy_status: 0,
        schedule_relationship: 0,
        stop_time_properties: {
          assigned_stop_id: '',
          stop_headsign: '',
          pickup_type: 0,
          drop_off_type: 0
        }
      },
      {
        stop_sequence: 12,
        stop_id: 'G1536-P1',
        arrival: {
          delay: 29,
          time: 1757831429,
          uncertainty: 0,
          scheduled_time: 0
        },
        departure: {
          delay: 29,
          time: 1757831429,
          uncertainty: 0,
          scheduled_time: 0
        },
        departure_occupancy_status: 0,
        schedule_relationship: 0,
        stop_time_properties: {
          assigned_stop_id: '',
          stop_headsign: '',
          pickup_type: 0,
          drop_off_type: 0
        }
      },
      {
        stop_sequence: 13,
        stop_id: 'G1521-P2',
        arrival: {
          delay: 29,
          time: 1757831849,
          uncertainty: 0,
          scheduled_time: 0
        },
        departure: {
          delay: 29,
          time: 1757831849,
          uncertainty: 0,
          scheduled_time: 0
        },
        departure_occupancy_status: 0,
        schedule_relationship: 0,
        stop_time_properties: {
          assigned_stop_id: 'G1521-P2',
          stop_headsign: '',
          pickup_type: 0,
          drop_off_type: 0
        }
      }, 
      {
        stop_sequence: 3,
        stop_id: '20308',
        arrival: undefined,
        departure: undefined,
        departure_occupancy_status: 0,
        schedule_relationship: 1,
        stop_time_properties: undefined
      }]
    }
  }]
}