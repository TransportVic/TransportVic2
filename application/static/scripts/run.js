let lostFocusTime

function checkFocus() {
  console.log(document.hidden, new Date())
  if (document.hidden) {
    lostFocusTime = new Date()
  } else {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > .5 * 60 * 1000) {
      updateBody() // If user wasn't focused - update the timings as soon as they come back
    }
  }
}

function updateBody() {
  if (document.hidden) {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > .5 * 60 * 1000) return
  }

  $.ajax({ method: 'POST' }, (err, status, body) => {
    if (!err && status === 200) {
      $('#content').innerHTML = body
      htmlData = body
    }
  })
}

document.on('visibilitychange', checkFocus)

$.ready(() => {
  setInterval(updateBody, 20 * 1000)
  checkFocus()
})
