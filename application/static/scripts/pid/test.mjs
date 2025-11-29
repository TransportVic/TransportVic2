function createPID(pidType) {
  switch (pidType) {
    case 'pre-plat-landscape':
      return new PrePlatformLandscapePID()
    case 'pre-plat-portrait':
      return new PrePlatformPortraitPID()
    case 'half-platform':
      return new HalfPlatformPID()
    case 'half-platform-bold':
      return new HalfPlatformBoldPID()
    default:
      return new MetroLCDPlatformPID()
  }
}

function updateBody() {
  $.ajax({
    method: 'POST',
    url: '/pid/data',
    data: {
      station: decodeURIComponent(search.hash.s),
      platform: decodeURIComponent(search.hash.p)
    }
  }, (err, status, body) => {
    if (err || status !== 200) return pid.showAnnouncementsMessage()
    pid.updateServices(body)
  })
}

function checkSameHost() {
  try {
    if ('ancestorOrigins' in window.location && window.location.ancestorOrigins.length) {
      return window.location.ancestorOrigins[0] === window.location.origin
    } else {
      return window.parent.location.origin === window.location.origin
    }
  } catch (e) {}
  return false
}

function updateBodyFromParent() {
  window.parent.postMessage({
    type: 'init-new',
    station: decodeURIComponent(search.hash.s),
    platform: decodeURIComponent(search.hash.p),
  }, location.origin)

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return
    if (event.data.type !== 'departure-data') return

    pid.updateServices(event.data.body)
  })
}

$.ready(() => {
  const pid = createPID(search.hash.t || location.pathname.split('/').pop())

  window.pid = pid
  pid.updateServices([])

  if (window.parent !== window && checkSameHost()) {
    updateBodyFromParent()
  } else {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }
})