import modules from '../modules.json' with { type: 'json' }

export default {
  'mockups/PIDSView': {
    path: '/',
    enable: modules.mockups && modules.mockups.pidsview
  },

  Index: '/',
  IndexData: '/',
  AdditionalLinks: '/links',
  Search: '/search',
  StopsNearby: '/nearby',

  PublicHolidayInfo: '/public-holiday',

  'timing-pages/VLine': {
    path: '/vline/timings',
    enable: modules.Next4 && modules.Next4.vline
  },
  'timing-pages/MetroTrains': {
    path: '/metro/timings',
    enable: modules.Next4 && modules.Next4.metro
  },
  'timing-pages/RegionalCoach': {
    path: '/coach/timings',
    enable: modules.Next4 && modules.Next4.coach
  },
  'timing-pages/Bus': {
    path: '/bus/timings',
    enable: modules.Next4 && modules.Next4.bus
  },
  'timing-pages/Tram': {
    path: '/tram/timings',
    enable: modules.Next4 && modules.Next4.tram
  },
  'timing-pages/Ferry': {
    path: '/ferry/timings',
    enable: modules.Next4 && modules.Next4.ferry
  },
  'timing-pages/HeritageTrain': {
    path: '/heritage/timings',
    enable: modules.Next4 && modules.Next4.heritage
  },

  'run-pages/MetroTrains': '/metro/run',
  'run-pages/VLineTrains': '/vline/run',
  'run-pages/Tram': '/tram/run',
  'run-pages/Bus': '/bus/run',
  'run-pages/Generic': '/',

  Statistics: '/stats',

  'mockups/Index': '/mockups',
  'mockups/fss/FlindersStreet': '/mockups/fss',
  'mockups/metro-lcd/Concourse-PIDS': '/mockups/metro-lcd/concourse',
  'mockups/metro-lcd/Metro-LCD-PIDS': '/mockups/metro-lcd',
  'mockups/BusInt-PIDS': '/mockups/bus-int-pids',
  'mockups/Metro-LED-PIDS': '/mockups/metro-led-pids',
  'mockups/Metro-CRT-PIDS': '/mockups/metro-crt',
  'mockups/VLine-PIDS': '/mockups/vline',
  // 'mockups/sss/SouthernCross': '/mockups/sss',
  'mockups/train/TrainPID': '/mockups/train',

  'mockups/sss-new/SSSNew': '/mockups/sss-new',
  'mockups/sss-new/SSSPlatform': '/mockups/sss-new/platform',
  'mockups/sss-new/SSSCoachBay': '/mockups/sss-new/coach',

  'jmss-screens/BigScreen': {
    path: '/jmss-screens/big-screen',
    enable: modules.jmssScreen
  },

  SmartrakIDs: '/smartrak',

  'tracker/BusTracker': '/bus/tracker',
  'tracker/BusMinderTracker': '/bus/tracker/busminder',
  'tracker/TramTracker': '/tram/tracker',
  'tracker/VLineTracker': '/vline/tracker',
  'tracker/MetroTracker': '/metro/tracker',

  'route-data/RegionalBusRoute': {
    path: '/bus/route/regional',
    enable: modules.routes && modules.routes.bus
  },
  'route-data/NamedBusRoute': {
    path: '/bus/route/named',
    enable: modules.routes && modules.routes.bus
  },
  'route-data/MetroBusRoute': {
    path: '/bus/route',
    enable: modules.routes && modules.routes.bus
  },

  'route-data/TramRoute': {
    path: '/tram/route',
    enable: modules.routes && modules.routes.tram
  },

  'route-data/MetroRoute': {
    path: '/metro/line',
    enable: modules.routes && modules.routes.metro
  },

  'route-data/VLineRoute': {
    path: '/vline/line',
    enable: modules.routes && modules.routes.vline
  },

  StopPreview: {
    path: '/stop-preview',
    enable: modules.stopPreview
  },

  RoutePreview: {
    path: '/route-preview',
    enable: modules.routePreview
  },

  RoutePaths: '/route-paths',
  MetroMap: '/metro/map'
}