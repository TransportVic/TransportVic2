let stationName = $('[name=station-name]').value

let children = []
let pidTypes = {}

let csrf

window.addEventListener('message', event => {
  if (event.origin !== location.origin) return
  if (event.data.type !== 'init') return

  let { pidType, urlPattern, platform } = event.data

  if (!csrf) csrf = event.data.csrf

  children.push({
    pidType,
    platform,
    window: event.source
  })

  if (!pidTypes[pidType]) {
    pidTypes[pidType] = { urlPattern, pidType }
  }

  if (children.length === 1) { // The first child to register
    setTimeout(fetchData, 100) // Give some time for the rest to register
    setTimeout(() => {
      fetchData()
      setInterval(fetchData, 1000 * 30)
    }, 30000 - (+new Date() % 30000))
  }
})

function fetchData() {
  for (let pidType of Object.values(pidTypes)) {
    let pids = children.filter(child => child.pidType === pidType.pidType)
    $.ajax({
      method: 'POST',
      url: pidType.urlPattern.replace('{station}', stationName),
      data: {
        csrf
      }
    }, (err, status, body) => {
      if (err) {
        for (let pid of pids) {
          pid.window.postMessage({
            type: 'departure-data',
            err,
            body: null
          })
        }
      } else {
        for (let pid of pids) {
          pid.window.postMessage({
            type: 'departure-data',
            err: null,
            body: {
              bus: body.bus,
              has: body.has,
              dep: body.dep.filter(dep => dep.plt === pid.platform),
            }
          })
        }
      }
    })
  }
}