import modules from '../modules.json' with { type: 'json' }

export default [
  { path: '/', router: 'mockups/PIDSView.js', enable: modules.mockups && modules.mockups.pidsview },
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
  { path: '/heritage/timings', router: 'timing-pages/HeritageTrain.mjs', enable: modules.Next4 && modules.Next4.heritage },

  { path: '/metro/run', router: 'run-pages/MetroTrains.mjs' },
  { path: '/vline/run', router: 'run-pages/VLineTrains.mjs' },
  { path: '/tram/run', router: 'run-pages/Tram.mjs' },
  { path: '/bus/run', router: 'run-pages/Bus.mjs' },
  { path: '/', router: 'run-pages/Generic.mjs' },

  { path: '/mockups', router: 'mockups/Index.mjs' },
  { path: '/mockups/fss', router: 'mockups/fss/FlindersStreet.js' },
  { path: '/mockups/metro-lcd/concourse', router: 'mockups/metro-lcd/Concourse-PIDS.js' },
  { path: '/mockups/metro-lcd', router: 'mockups/metro-lcd/Metro-LCD-PIDS.js' },
  { path: '/mockups/bus-int-pids', router: 'mockups/BusInt-PIDS.js' },
  { path: '/mockups/metro-led-pids', router: 'mockups/Metro-LED-PIDS.js' },
  { path: '/mockups/metro-crt', router: 'mockups/Metro-CRT-PIDS.js' },
  { path: '/mockups/vline', router: 'mockups/VLine-PIDS.js' },
  // { path: '/mockups/sss', router: 'mockups/sss/SouthernCross.js' },
  { path: '/mockups/train', router: 'mockups/train/TrainPID.js' },
  { path: '/mockups/sss-new', router: 'mockups/sss-new/SSSNew.js' },
  { path: '/mockups/sss-new/platform', router: 'mockups/sss-new/SSSPlatform.js' },
  { path: '/mockups/sss-new/coach', router: 'mockups/sss-new/SSSCoachBay.js' },
  { path: '/jmss-screens/big-screen', router: 'jmss-screens/BigScreen.js', enable: modules.jmssScreen },

  { path: '/smartrak', router: 'SmartrakIDs.mjs' },
  { path: '/bus/tracker', router: 'tracker/BusTracker.js' },
  { path: '/tram/tracker', router: 'tracker/TramTracker.js' },
  { path: '/vline/tracker', router: 'tracker/VLineTracker.js' },
  { path: '/metro/tracker', router: 'tracker/MetroTracker.js' },

  { path: '/bus/route/regional', router: 'route-data/RegionalBusRoute.js', enable: modules.routes && modules.routes.bus },
  { path: '/bus/route/named', router: 'route-data/NamedBusRoute.js', enable: modules.routes && modules.routes.bus },
  { path: '/bus/route', router: 'route-data/MetroBusRoute.js', enable: modules.routes && modules.routes.bus },
  { path: '/tram/route', router: 'route-data/TramRoute.js', enable: modules.routes && modules.routes.tram },
  { path: '/metro/line', router: 'route-data/MetroRoute.js', enable: modules.routes && modules.routes.metro },
  { path: '/vline/line', router: 'route-data/VLineRoute.js', enable: modules.routes && modules.routes.vline },

  { path: '/stop-preview', router: 'StopPreview.mjs', enable: modules.stopPreview },
  { path: '/route-preview', router: 'RoutePreview.mjs', enable: modules.routePreview },
  { path: '/route-paths', router: 'RoutePaths.mjs' },
  { path: '/metro/map', router: 'MetroMap.mjs' }

]