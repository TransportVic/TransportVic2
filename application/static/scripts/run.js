let isFocused = true
let lostFocusTime

function checkFocus() {
  let isNowFocused = document.hasFocus()
  if (!isNowFocused) {
    lostFocusTime = new Date()
  } else {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 5 * 60 * 1000 && !isFocused) {
      updateBody() // If user wasn't focused - update the timings as soon as they come back
    }
  }

  isFocused = isNowFocused
}

function updateBody() {
  if (!isFocused) {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 5 * 60 * 1000) return
  }

  $.ajax({ method: 'POST' }, (err, status, body) => {
    if (!err && status === 200) {
      $('#content').innerHTML = body
      htmlData = body
    }
  })
}

window.on("focus", checkFocus)
window.on("blur", checkFocus)

$.ready(() => {
  setInterval(updateBody, 30 * 1000)
  checkFocus()
})
