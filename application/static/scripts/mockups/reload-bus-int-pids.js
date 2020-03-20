function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  return mainTime
}

function updateClock() {
  $('#current-time').textContent = formatTime(new Date())
}

$.ready(() => {
  let t = new Date()
  setTimeout(() => {
    updateClock()
    setInterval(updateClock, 1000)
  }, t % 1000)
})
