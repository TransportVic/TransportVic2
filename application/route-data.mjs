import modules from '../modules.json' with { type: 'json' }

export default [
  { path: '/', router: 'mockups/PIDSView.mjs', enable: modules.mockups && modules.mockups.pidsview },
  { path: '/', router: 'Index.mjs' },
  { path: '/', router: 'IndexData.mjs' },
  { path: '/links', router: 'AdditionalLinks.mjs' },
  { path: '/search', router: 'Search.mjs' },
  { path: '/nearby', router: 'StopsNearby.mjs' },
  { path: '/public-holiday', router: 'PublicHolidayInfo.mjs' },

  { path: '/vline/timings', router: 'timing-pages/VLine.mjs', enable: modules.Next4 && modules.Next4.vline },
  { path: '/metro/timings', router: 'timing-pages/MetroTrains.mjs', enable: modules.Next4 && modules.Next4.metro },
  { path: '/coach/timings', router: 'timing-pages/RegionalCoach.mjs', enable: modules.Next4 && modules.Next4.coach },
  { path: '/bus/timings', router: 'timing-pages/Bus.mjs', enable: modules.Next4 && modules.Next4.bus },
  { path: '/tram/timings', router: 'timing-pages/Tram.mjs', enable: modules.Next4 && modules.Next4.tram },
  { path: '/ferry/timings', router: 'timing-pages/Ferry.mjs', enable: modules.Next4 && modules.Next4.ferry },

  { path: '/metro/run', router: 'run-pages/MetroTrains.mjs' },
  { path: '/vline/run', router: 'run-pages/VLineTrains.mjs' },
  { path: '/tram/run', router: 'run-pages/Tram.mjs' },
  { path: '/bus/run', router: 'run-pages/Bus.mjs' },
  { path: '/', router: 'run-pages/Generic.mjs' },

  { path: '/pid', router: 'pid/PIDView.mjs' },

  { path: '/mockups', router: 'mockups/Index.mjs' },
  { path: '/mockups/fss', router: 'mockups/fss/FlindersStreet.mjs' },
  { path: '/mockups/metro-lcd/concourse', router: 'mockups/metro-lcd/Concourse-PIDS.mjs' },
  { path: '/mockups/metro-lcd', router: 'mockups/metro-lcd/Metro-LCD-PIDS.mjs' },
  { path: '/mockups/bus-int-pids', router: 'mockups/BusInt-PIDS.mjs' },
  { path: '/mockups/metro-led-pids', router: 'mockups/Metro-LED-PIDS.mjs' },
  { path: '/mockups/metro-crt', router: 'mockups/Metro-CRT-PIDS.mjs' },
  { path: '/mockups/vline', router: 'mockups/VLine-PIDS.mjs' },
  // { path: '/mockups/sss', router: 'mockups/sss/SouthernCross.js' },
  { path: '/mockups/train', router: 'mockups/train/TrainPID.mjs' },
  { path: '/mockups/sss-new', router: 'mockups/sss-new/SSSNew.mjs' },
  { path: '/mockups/sss-new/platform', router: 'mockups/sss-new/SSSPlatform.mjs' },
  { path: '/mockups/sss-new/coach', router: 'mockups/sss-new/SSSCoachBay.mjs' },
  { path: '/jmss-screens/big-screen', router: 'jmss-screens/BigScreen.mjs', enable: modules.jmssScreen },

  { path: '/bus/tracker', router: 'tracker/bus/BusTracker.mjs' },
  { path: '/tram/tracker', router: 'tracker/TramTracker.mjs' },
  { path: '/vline/tracker', router: 'tracker/VLineTracker.mjs' },
  { path: '/metro/tracker', router: 'tracker/MetroTracker.mjs' },

  { path: '/bus/route/regional', router: 'route-data/RegionalBusRoute.mjs', enable: modules.routes && modules.routes.bus },
  { path: '/bus/route/named', router: 'route-data/NamedBusRoute.mjs', enable: modules.routes && modules.routes.bus },
  { path: '/bus/route', router: 'route-data/MetroBusRoute.mjs', enable: modules.routes && modules.routes.bus },
  { path: '/tram/route', router: 'route-data/TramRoute.mjs', enable: modules.routes && modules.routes.tram },
  { path: '/metro/line', router: 'route-data/MetroRoute.mjs', enable: modules.routes && modules.routes.metro },
  { path: '/vline/line', router: 'route-data/VLineRoute.mjs', enable: modules.routes && modules.routes.vline },

  { path: '/stop-preview', router: 'StopPreview.mjs', enable: modules.stopPreview },
  { path: '/route-preview', router: 'RoutePreview.mjs', enable: modules.routePreview },
  { path: '/route-paths', router: 'RoutePaths.mjs' },
  { path: '/metro/map', router: 'MetroMap.mjs' }

]