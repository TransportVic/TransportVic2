let stationName = $('[name=station-name]').value

let children = []
let pidTypes = {}

let csrf

window.addEventListener('message', event => {
  if (event.origin !== location.origin) return
  if (event.data.type !== 'init') return

  let { pidType, pidClass, platform } = event.data

  if (!csrf) csrf = event.data.csrf

  children.push({
    pidClass,
    pidType,
    platform,
    window: event.source
  })

  let pidTypeID = `${pidClass}/${pidType}`

  if (!pidTypes[pidTypeID]) {
    pidTypes[pidTypeID] = { pidClass, pidType }
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
    let pids = children.filter(child => child.pidType === pidType.pidType && child.pidClass === pidType.pidClass)
    $.ajax({
      method: 'POST',
      url: `/mockups/${pidType.pidClass}/${stationName}/*/${pidType.pidType}`,
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