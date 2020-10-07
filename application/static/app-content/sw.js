const version = '105'
const cacheName = `transportvic-${version}`

function cacheFiles(files) {
  return caches.open(cacheName).then(cache => {
    console.log('Caching files')

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
        console.log('Old cache ' + storedCacheName + ' deleted')
      })
    }))
  })

  e.waitUntil(
    cacheFiles([
      '/static/css/runs/base-style.css',

      '/static/css/timings/base-style.css',

      '/static/css/routes/base-style.css',

      '/static/css/tracker/results.css',

      '/static/css/about.css',
      '/static/css/base-style.css',
      '/static/css/combined-colours.css',
      '/static/css/constant-colours.css',
      '/static/css/content-error.css',
      '/static/css/form.css',
      '/static/css/index.css',
      '/static/css/links.css',
      '/static/css/loading.css',
      '/static/css/rail-map.css',
      '/static/css/search.css',
      '/static/css/smartrak.css',
      '/static/css/textbar-style.css',

      '/static/css/mockups/16-9-pids-base.css',
      '/static/css/mockups/32-9-pids-base.css',
      '/static/css/mockups/actual-line-colours.css',
      '/static/css/mockups/base-style.css',
      '/static/css/mockups/summary.css',

      '/static/css/mockups/fss/platform.css',
      '/static/css/mockups/fss/escalator.css',
      '/static/css/mockups/fss/trains-from-fss.css',

      '/static/css/mockups/metro-lcd/concourse-interchange.css',
      '/static/css/mockups/metro-lcd/concourse-up-down.css',
      '/static/css/mockups/metro-lcd/half-platform-bold.css',
      '/static/css/mockups/metro-lcd/half-platform.css',
      '/static/css/mockups/metro-lcd/platform.css',
      '/static/css/mockups/metro-lcd/pre-platform-vertical.css',

      '/static/css/mockups/sss-new/coach.css',
      '/static/css/mockups/sss-new/platform.css',

      '/static/fonts/Nunito.ttf',
      '/static/fonts/NetworkSans-2018-Bold.ttf',
      '/static/fonts/NetworkSans-2018-Medium.ttf',
      '/static/fonts/NetworkSans-2018-Regular.ttf',

      '/static/images/decals/ac.svg',
      '/static/images/decals/wheelchair.svg',

      '/static/images/decals/bookmark.svg',
      '/static/images/decals/bookmark-filled.svg',
      '/static/images/decals/map.svg',
      '/static/images/decals/nosleep.svg',

      '/static/images/clear-icons/bus.svg',
      '/static/images/clear-icons/coach.svg',
      '/static/images/clear-icons/ferry.svg',
      '/static/images/clear-icons/metro.svg',
      '/static/images/clear-icons/tram.svg',
      '/static/images/clear-icons/vline.svg',

      '/static/images/favicon/favicon192.png',
      '/static/images/favicon/favicon512.png',

      '/static/images/home/404.svg',
      '/static/images/home/500.svg',
      '/static/images/home/about.svg',
      '/static/images/home/nearby.svg',
      '/static/images/home/no-route.svg',
      '/static/images/home/no-stop.svg',
      '/static/images/home/no-trip.svg',
      '/static/images/home/rainbow.svg',
      '/static/images/home/search.svg',
      '/static/images/home/smartbus.svg',
      '/static/images/home/website-down.svg',

      '/static/images/icons/comeng.svg',
      '/static/images/icons/siemens.svg',
      '/static/images/icons/xtrapolis.svg',
      '/static/images/icons/hcmt.svg',
      '/static/images/icons/hitachi.svg',

      '/static/images/icons/n.svg',
      '/static/images/icons/sprinter.svg',
      '/static/images/icons/vlocity.svg',
      '/static/images/icons/xpt.svg',

      '/static/images/icons/cr228l.svg',
      '/static/images/icons/designline.svg',
      '/static/images/icons/gemilang.svg',
      '/static/images/icons/optare.svg',
      '/static/images/icons/optimus.svg',

      '/static/images/icons/a-b.svg',
      '/static/images/icons/c1.svg',
      '/static/images/icons/d.svg',
      '/static/images/icons/z3.svg',

      '/static/images/mockups/announcements.svg',
      '/static/images/mockups/no-boarding-train.svg',
      '/static/images/mockups/express-arrow.svg',
      '/static/images/mockups/station-express.svg',
      '/static/images/mockups/station-filler.svg',
      '/static/images/mockups/station-stops-at.svg',
      '/static/images/mockups/station-stub.svg',
      '/static/images/mockups/station-terminates.svg',

      '/static/images/mockups/information.svg',
      '/static/images/mockups/geometric-shape.svg',

      '/static/scripts/mockups/pids-utils.js',

      '/static/scripts/tracker/locator.js',

      '/static/scripts/bookmarks.js',
      '/static/scripts/dropdown.js',
      '/static/scripts/nearby.js',
      '/static/scripts/route-paths.js',
      '/static/scripts/route-preview.js',
      '/static/scripts/search.js',
      '/static/scripts/smartrak.js',
      '/static/scripts/stats.js',
      '/static/scripts/stop-preview.js',
      '/static/scripts/sw-load.js',
      '/static/scripts/timings.js',
      '/static/scripts/updating.js',
      '/static/scripts/util.js',
      '/static/scripts/index.js',

      '/static/scripts/mockups/pids-utils.js',

      '/',
      '/links',
      '/nearby',
      '/search',
      '/railmap'
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
