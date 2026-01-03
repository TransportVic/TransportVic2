import serviceListDefinitions, { minimumTimes } from './service-list-definitions.mjs'

let allPIDs = []

function getPIDDefinition() {
  const station = decodeURIComponent(search.hash.s)
  const type = decodeURIComponent(search.hash.t)

  if (!serviceListDefinitions[station]) return null
  return serviceListDefinitions[station][type]
}

function getMinimumTime() {
  const station = decodeURIComponent(search.hash.s)
  return minimumTimes[station] || -1
}

function createPID() {
  const definition = getPIDDefinition()
  if (!definition) return

  const container = $('div.pid')

  const { orientation, headerStyle, getComponents } = definition
  container.classList.add(orientation)

  const {
    pids, header, area
  } = getComponents()

  if (header) {
    container.style.setProperty('--header-content-height', `calc(var(--height) * ${headerStyle.height})`)
    container.style.setProperty('--header-margin', `calc(var(--height) * ${headerStyle.margin})`)

    header.mount('div.pid')
  } else {
    container.style.setProperty('--header-content-height', '0px')
    container.style.setProperty('--header-margin', '0px')
  }

  if (area) area.mount('div.pid')

  allPIDs = pids
}

function setServices(services) {
  const minimumTime = getMinimumTime()
  const relevantServices = services.filter(service => service.estTime >= minimumTime)

  for (const { pid, filter } of allPIDs) pid.updateServices(relevantServices.filter(filter))
}

function updateBody() {
  $.ajax({
    method: 'POST',
    url: '/pid/data',
    data: {
      station: decodeURIComponent(search.hash.s)
    }
  }, (err, status, body) => {
    setServices(body)
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
    station: decodeURIComponent(search.hash.s)
  }, location.origin)

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return
    if (event.data.type !== 'departure-data') return

    setServices(event.data.body)
  })
}

$.ready(() => {
  createPID()

  if (window.parent !== window && checkSameHost()) {
    updateBodyFromParent()
  } else {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }
})