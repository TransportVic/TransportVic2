let lostFocusTime

function checkFocus() {
  if (document.hidden) {
    lostFocusTime = new Date()
  } else {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 2 * 60 * 1000) {
      updateBody() // If user wasn't focused - update the timings as soon as they come back
    }
  }
}

function updateBody() {
  if (document.hidden) {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 2 * 60 * 1000) return
  }

  $.ajax({ method: 'POST' }, (err, status, body) => {
    if (!err && status === 200) {
      $('#content').innerHTML = body
      checkViperLink()
    }
  })
}

function checkViperLink() {
  const text = $('#viper-link')
  if (!text) return
  text.on('click', () => {
    if (window.confirm('Viper says hi! Click Ok to check out his YouTube!')) {
      window.open('https://www.youtube.com/@iluvsiemens', '_blank')
    }
  })
}

document.on('visibilitychange', checkFocus)

$.ready(() => {
  setInterval(updateBody, 20 * 1000)
  checkFocus()

  checkViperLink()
})
