function createPID(pidType) {
  switch (pidType) {
    case 'pre-plat-landscape':
      return new PrePlatformLandscapePID()
    case 'pre-plat-portrait':
      return new PrePlatformPortraitPID()
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
    pid.updateServices(body)
  })
}

$.ready(() => {
  const pid = createPID(search.hash.t)

  window.pid = pid
  pid.updateServices([])

  updateBody()
  setInterval(updateBody, 1000 * 30)
})