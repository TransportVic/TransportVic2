let stationName = $('[name=station-name]').value

let children = []
let pidTypes = {}

let csrf
let lastRequestData = {}

window.addEventListener('message', event => {
  if (event.origin !== location.origin) return
  if (event.data.type !== 'init') return

  let { pidType, urlPattern, platform } = event.data

  if (!csrf) csrf = event.data.csrf

  let pid = {
    pidType,
    platform,
    window: event.source
  }

  children.push(pid)

  if (!pidTypes[pidType]) {
    let pidData = { urlPattern, pidType }
    pidTypes[pidType] = pidData
    fetchPIDType(pidData)
  } else {
    if (lastRequestData[pidType]) {
      let { err, body } = lastRequestData[pidType]
      sendPIDData(pid, err, body)
    }
  }

  if (children.length === 1) { // The first child to register
    setTimeout(() => {
      fetchData()
      setInterval(fetchData, 1000 * 30)
    }, 30000 - (+new Date() % 30000))
  }
})

function sendPIDData(pid, err, body) {
  if (err) {
    pid.window.postMessage({
      type: 'departure-data',
      err,
      body: null
    })
  } else {
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

function fetchPIDType(pidType) {
  $.ajax({
    method: 'POST',
    url: pidType.urlPattern.replace('{station}', stationName),
    data: {
      csrf
    }
  }, (err, status, body) => {
    lastRequestData[pidType.pidType] = { err, body }
    let pids = children.filter(child => child.pidType === pidType.pidType)

    for (let pid of pids) sendPIDData(pid, err, body)
  })
}

function fetchData() {
  for (let pidType of Object.values(pidTypes)) fetchPIDType(pidType)
}