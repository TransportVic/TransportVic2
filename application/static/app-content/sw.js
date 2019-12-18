const version = "0.0.20a"
const cacheName = `transportvic-${version}`

function cacheFiles(files) {
  return caches.open(cacheName).then(cache => {
    return cache.addAll(files).then(() => self.skipWaiting())
    .catch(e => {
      console.error(e)
      return ''
    })
  })
}

self.addEventListener('install', e => {
  const timeStamp = Date.now()

  caches.keys().then(function (cachesNames) {
    return Promise.all(cachesNames.map((storedCacheName) => {
      if (storedCacheName === cacheName || !storedCacheName.startsWith('transportvic')) return Promise.resolve()
      return caches.delete(storedCacheName).then(() => {
        console.log("Old cache " + storedCacheName + " deleted")
      })
    }))
  })

  e.waitUntil(
    cacheFiles([
      '/static/css/jmss-screens/base-style.css',
      '/static/css/jmss-screens/big-screen.css',

      '/static/css/mockups/actual-line-colours.css',
      '/static/css/mockups/base-style.css',
      '/static/css/mockups/fss-escalator.css',
      '/static/css/mockups/mini-pids.css',

      '/static/css/runs/base-style.css',

      '/static/css/timings/base-style.css',

      '/static/css/base-style.css',
      '/static/css/combined-colours.css',
      '/static/css/index.css',
      '/static/css/search.css',
      '/static/css/textbar-style.css',

      '/static/fonts/bree-serif.otf',
      '/static/fonts/LiberationSans-Bold.otf',
      '/static/fonts/LiberationSans-Regular.otf',

      '/static/images/decals/ac.svg',
      '/static/images/decals/wheelchair.svg',

      '/static/images/clear-icons/bus.svg',
      '/static/images/clear-icons/metro.svg',
      '/static/images/clear-icons/vline.svg',

      '/static/images/favicon/favicon192.png',
      '/static/images/favicon/favicon512.png',

      '/static/images/home/about.svg',
      '/static/images/home/button.svg',
      '/static/images/home/nearby.svg',
      '/static/images/home/search.svg',
      '/static/images/home/smartbus.svg',

      '/static/images/icons/comeng.svg',
      '/static/images/icons/siemens.svg',
      '/static/images/icons/xtrapolis.svg',

      '/static/images/icons/n.svg',
      '/static/images/icons/sprinter.svg',
      '/static/images/icons/vlocity.svg',

      '/static/images/icons/cr228l.svg',
      '/static/images/icons/optimus.svg',

      '/static/images/mockups/no-boarding-train.svg',
      '/static/images/mockups/station-express.svg',
      '/static/images/mockups/station-filler.svg',
      '/static/images/mockups/station-halfstub.svg',
      '/static/images/mockups/station-stopsat.svg',
      '/static/images/mockups/station-stub.svg',
      '/static/images/mockups/station-terminates.svg',

      '/static/scripts/mockups/reload-fss-escalator.js',
      '/static/scripts/mockups/reload-mini-lcd.js',

      'https://cdn.plot.ly/plotly-latest.min.js',
      'https://unpkg.com/leaflet@1.6.0/dist/leaflet.css',
      'https://unpkg.com/leaflet@1.6.0/dist/leaflet.js',

      '/static/scripts/geojson-visualise.js',
      '/static/scripts/nearby.js',
      '/static/scripts/search.js',
      '/static/scripts/sw-load.js',
      '/static/scripts/timings.js',
      '/static/scripts/util.js',

      '/',
      '/nearby',
      '/search'
    ])
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  if (event.request.method != 'GET') return

  event.respondWith(
    caches.open(cacheName)
    .then(cache => cache.match(event.request, {ignoreSearch: true}))
    .then(response => {
      return response || fetch(event.request)
    })
  )
})
