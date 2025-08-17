export default {
  mode: 'metro train',
  routeGTFSID: '2-ALM',
  operationDays: '20250817',
  tripID: null,
  shapeID: null,
  block: null,
  gtfsDirection: null,
  runID: '8543',
  isRailReplacementBus: false,
  vehicle: {
    size: '1',
    type: null,
    consist: [ 'STEAM TRAIN' ],
    forced: true,
    icon: 'RClass'
  },
  direction: 'Down',
  routeName: 'Alamein',
  routeNumber: null,
  origin: 'Flinders Street Railway Station',
  destination: 'Ashburton Railway Station',
  departureTime: '10:24',
  destinationArrivalTime: '10:40',
  stopTimings: [
    {
      stopName: 'Flinders Street Railway Station',
      stopNumber: null,
      suburb: 'Melbourne',
      stopGTFSID: 'vic:rail:FSS',
      arrivalTime: '10:24',
      arrivalTimeMinutes: 624,
      departureTime: '10:24',
      departureTimeMinutes: 624,
      estimatedDepartureTime: '2025-08-17T00:25:40.000Z',
      scheduledDepartureTime: '2025-08-17T00:24:00.000Z',
      actualDepartureTimeMS: 1755390340000,
      platform: '4',
      cancelled: false,
      additional: false,
      stopConditions: { pickup: 0, dropoff: 1 }
    },
    {
      stopName: 'Burnley Railway Station',
      stopNumber: null,
      suburb: 'Richmond',
      stopGTFSID: 'vic:rail:BLY',
      arrivalTime: '10:29',
      arrivalTimeMinutes: 629,
      departureTime: '10:29',
      departureTimeMinutes: 629,
      estimatedDepartureTime: '2025-08-17T00:32:00.000Z',
      scheduledDepartureTime: '2025-08-17T00:29:00.000Z',
      actualDepartureTimeMS: 1755390720000,
      platform: '4',
      cancelled: true,
      additional: false,
      stopConditions: { pickup: 0, dropoff: 0 }
    },
    {
      stopName: 'Camberwell Railway Station',
      stopNumber: null,
      suburb: 'Camberwell',
      stopGTFSID: 'vic:rail:CAM',
      arrivalTime: '10:35',
      arrivalTimeMinutes: 635,
      departureTime: '10:35',
      departureTimeMinutes: 635,
      estimatedDepartureTime: '2025-08-17T00:38:00.000Z',
      scheduledDepartureTime: '2025-08-17T00:35:00.000Z',
      actualDepartureTimeMS: 1755391080000,
      platform: '3',
      cancelled: true,
      additional: false,
      stopConditions: { pickup: 0, dropoff: 0 }
    },
    {
      stopName: 'Riversdale Railway Station',
      stopNumber: null,
      suburb: 'Camberwell',
      stopGTFSID: 'vic:rail:RIV',
      arrivalTime: '10:38',
      arrivalTimeMinutes: 638,
      departureTime: '10:38',
      departureTimeMinutes: 638,
      estimatedDepartureTime: '2025-08-17T00:41:00.000Z',
      scheduledDepartureTime: '2025-08-17T00:38:00.000Z',
      actualDepartureTimeMS: 1755391260000,
      platform: '2',
      cancelled: true,
      additional: false,
      stopConditions: { pickup: 0, dropoff: 0 }
    },
    {
      stopName: 'Ashburton Railway Station',
      stopNumber: null,
      suburb: 'Ashburton',
      stopGTFSID: 'vic:rail:ASH',
      arrivalTime: '10:40',
      arrivalTimeMinutes: 640,
      departureTime: '10:40',
      departureTimeMinutes: 640,
      estimatedDepartureTime: '2025-08-17T00:46:00.000Z',
      scheduledDepartureTime: '2025-08-17T00:40:00.000Z',
      actualDepartureTimeMS: 1755391560000,
      platform: '1',
      cancelled: false,
      additional: false,
      stopConditions: { pickup: 1, dropoff: 0 }
    }
  ],
  formedBy: '8542',
  forming: '8544',
  changes: [
    {
      type: 'forming-change',
      oldVal: null,
      newVal: '8544',
      timestamp: '2025-08-16T20:37:12.541Z',
      source: 'ptv-departure'
    },
    {
      type: 'veh-change',
      oldVal: null,
      newVal: {
        size: 1,
        type: 'Unknown',
        consist: [ 'STEAM TRAIN' ],
        forced: true,
        icon: 'RClass'
      },
      timestamp: '2025-08-17T00:25:46.370Z',
      source: null
    },
    {
      type: 'veh-change',
      oldVal: null,
      newVal: {
        size: 1,
        type: 'Unknown',
        consist: [ 'STEAM TRAIN' ],
        forced: true,
        icon: 'RClass'
      },
      timestamp: '2025-08-17T00:25:46.370Z',
      source: null
    },
    {
      type: 'veh-change',
      oldVal: {
        size: 1,
        type: 'Unknown',
        consist: [ 'STEAM TRAIN' ],
        forced: true,
        icon: 'RClass'
      },
      newVal: {
        size: '1',
        type: null,
        consist: [ 'STEAM TRAIN' ],
        forced: true,
        icon: 'RClass'
      },
      timestamp: '2025-08-17T00:26:49.044Z',
      source: null
    },
    {
      type: 'stop-time-change',
      oldVal: '2025-08-17T00:43:00.000Z',
      newVal: '2025-08-17T00:40:00.000Z',
      timestamp: '2025-08-17T00:32:28.701Z',
      source: 'manual'
    },
    {
      type: 'stop-cancelled',
      stopGTFSID: 'vic:rail:BLY',
      oldVal: false,
      newVal: true,
      timestamp: '2025-08-17T00:32:28.701Z',
      source: 'manual'
    },
    {
      type: 'stop-cancelled',
      stopGTFSID: 'vic:rail:CAM',
      oldVal: false,
      newVal: true,
      timestamp: '2025-08-17T00:32:28.701Z',
      source: 'manual'
    },
    {
      type: 'stop-cancelled',
      stopGTFSID: 'vic:rail:RIV',
      oldVal: false,
      newVal: true,
      timestamp: '2025-08-17T00:32:28.702Z',
      source: 'manual'
    }
  ],
  cancelled: false,
  additional: false,
  lastUpdated: 1755390748694
}