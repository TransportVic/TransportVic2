$.ready(() => {
  let logPre = $('#updatingLog')
  let players = []

  function addLine(line, scroll) {
    let span = document.createElement('p')

    span.textContent = line

    let autoScroll = logPre.scrollHeight - logPre.scrollTop - logPre.clientHeight < 1
    logPre.appendChild(span)

    if (autoScroll && scroll) {
      logPre.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }

  function wsListener(data) {
    data = JSON.parse(data.data)

    if (data.type === 'log-newline') {
      addLine(data.line, true)
    }

    if (data.type === 'complete') {
      addLine('Complete!')
      setTimeout(() => {
        location.reload()
      }, 5000)
    }
  }

  let websocketPath = location.protocol.replace('http', 'ws') + '//' + location.host
  let websocket

  function recreate(timeout=5000) {
    websocket = null
    setTimeout(() => {
      websocket = new WebSocket(websocketPath)

      websocket.onclose = () => {recreate()}
      websocket.addEventListener('message', wsListener)
    }, timeout)
  }

  $.ajax({
    method: 'GET',
    url: '/log'
  }, (err, status, data) => {
    addLine('Begin log...')

    data.forEach(line => {
      addLine(line, false)
    })

    recreate(1)
  })
})
