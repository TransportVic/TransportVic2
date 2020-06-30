function formatTime(time, includeSeconds=false, space=false) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let seconds = time.getSeconds()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'

  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  if (includeSeconds) {
    mainTime += ':'

    if (seconds < 10) mainTime += '0'
    mainTime += seconds
  }

  if (space) mainTime += ' '

  if (time.getHours() >= 12)
    mainTime += 'pm'
  else
    mainTime += 'am'

  return mainTime
}

function setTime() {
  $('.clock span').textContent = formatTime(new Date(), true, true)
}

function setupClock() {
  setTime()
  let msToNextSecond = 1000 - (+new Date() % 1000)
  setTimeout(() => {
    setTime()
    setInterval(setTime, 1000)
  }, msToNextSecond)
}

let currentlyDisplaying = 'next-out'

function setFullMessageActive(active) {
  if (active) {
    $('.content').style = 'display: none;'
    $('.fullMessage').style = 'display: flex;'
  } else {
    currentlyDisplaying = 'next-out'
    $('.content').style = 'display: flex;'
    $('.fullMessage').style = 'display: none;'
  }
}

function setListenAnnouncements() {
  if (currentlyDisplaying !== 'announcements') {
    currentlyDisplaying = 'announcements'
    $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
    setFullMessageActive(true)
  }
}

function setSVGSize() {
  let windowSize = parseInt(getComputedStyle(document.body).getPropertyValue('width').slice(0, -2))
  let targetSize = windowSize * 0.47

  let scalingFactor = targetSize / 59.953

  let containerHeight = targetSize * (36.838/59.953)

  $('#cclSVG').style = `transform: scale(${scalingFactor})`
  $('#svgContainer').style = `height: ${containerHeight}px`
}

$.ready(() => {
  setTimeout(() => {
    setSVGSize()
    $('#cclSVG').setAttribute('display', '')
  }, 50)

  setupClock()
})

window.on('resize', setSVGSize) // really just a utility function...
