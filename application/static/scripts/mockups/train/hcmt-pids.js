let pidData = null
let currentlyShowing = 'service'

function encodeName(name) {
  return name.toLowerCase().replace(/[^\w\d ]/g, '-').replace(/  */g, '-').replace(/--+/g, '-').replace(/-$/, '').replace(/^-/, '')
}

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  if (hours < 10) mainTime += '0'
  mainTime += hours
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  return mainTime
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

async function loadPIDData() {
  return new Promise(resolve => {
    $.ajax({ method: 'POST' }, (err, status, body) => {
      resolve(body)
    })
  })
}

function setMiddlePIDActive(type) {
  $('.middlePID .serviceDestination').style.display = 'none'
  $('.middlePID .announcements').style.display = 'none'
  $('.middlePID .text').style.display = 'none'

  $(`.middlePID .${type}`).style.display = ''
}

function setDestination(destination) {
  $('.frontDesto .destination').textContent = destination
  $('.middlePID .destination').textContent = destination
  $('.patternPID .destination').textContent = destination
}

function setVia(via) {
  $('.frontDesto .via').textContent = via
  $('.middlePID .destination').textContent = $('.middlePID .destination').textContent.replace(/ via.*/, '') + ' ' + via
  $('.patternPID .via').textContent = via
}

function setType(type) {
  $('.middlePID .type').textContent = type
  $('.patternPID .type').textContent = type
}

function setLine(className) {
  $('.middlePID .destination').className = 'destination ' + className
}

let stationHTMLs = {
  terminusLeft: `<div class="stationRow half">
  <div class="top left"><div class="stud {0}"></div></div>
  <div class="mainBody {0}"></div>
  <div class="bottom left"><div class="stud {0}"></div></div>
  </div>`,
  terminusRight: `<div class="stationRow half">
  <div class="top right"><div class="stud {0}"></div></div>
  <div class="mainBody {0}"></div>
  <div class="bottom right"><div class="stud {0}"></div></div>
  </div>`,
  stopsAt: `<div class="stationRow full">
  <div class="top"><div class="stud {0}"></div></div>
  <div class="mainBody {0}"></div>
  <div class="bottom"></div>
  </div>`,
  express: `<div class="stationRow full">
  <div class="top"></div>
  <div class="mainBody {0}"></div>
  <div class="bottom"></div>
  </div>`,
}

function createStationSVG(stoppingType) {
  return stationHTMLs[stoppingType]
}

function adjustStopName(stopName) {
  if (stopName === 'Upper Ferntree Gully') return 'Upper F.T Gully'
  return stopName
}

function setStoppingPattern(lineStops, tripStops, routeName) {
  let first = tripStops[0]
  let last = tripStops.slice(-1)[0]

  let middle = lineStops.slice(1, -1)

  let patternHTML = ''
  let namesHTML = ''

  let tripStopNames = tripStops.map(stop => stop.stopName)

  patternHTML += createStationSVG('terminusLeft')

  let expressStops = []

  middle.forEach(lineStop => {
    let isExpress = !tripStopNames.includes(lineStop)
    if (isExpress) expressStops.push(lineStop)

    patternHTML += createStationSVG(isExpress ? 'express' : 'stopsAt')
  })
  patternHTML += createStationSVG('terminusRight')

  let now = +new Date()
  let nextStop = tripStops.find(stop => stop.actualDepartureMS > now)
  let stopCount = lineStops.length
  let totalSize = 93
  let individualSize = totalSize / stopCount

  namesHTML = lineStops.map((stop, i) => {
    return `<span class="${expressStops.includes(stop) ? 'express' : ''}" style="margin-left: ${individualSize * i}vw;">${adjustStopName(stop)}</span>`
  }).join('')

  $('.stoppingPattern').innerHTML = patternHTML.replace(/\{0}/g, routeName)
  $('.stoppingPattern').style = `--stationRowSize: ${individualSize}vw`
  $('.stationNames').innerHTML = namesHTML

  return expressStops.length
}

function displayPIDData() {
  let tripStops = pidData.tripStops.map(stop => stop.stopName)
  let destination = tripStops.slice(-1)[0]
  let viaLoop = tripStops.includes('Parliament')

  setDestination(destination)
  if (viaLoop) {
    setVia('via City Loop')
  } else setVia('')

  let codedRouteName = encodeName(pidData.routeName)

  setLine(codedRouteName)
  let expressCount = setStoppingPattern(pidData.lineStops, pidData.tripStops, codedRouteName)

  if (expressCount === 0) setType('Stops All Stations')
  else if (expressCount <= 4) setType('Limited Express')
  else setType('Express')

  setMiddlePIDActive('serviceDestination')
}

function setTime() {
  $('.clock span').textContent = formatTime(new Date())
}

function setupClock() {
  setTime()
  let msToNextSecond = 1000 - (+new Date() % 1000)
  setTimeout(() => {
    setTime()
    setInterval(setTime, 1000)
  }, msToNextSecond)
}

$.ready(async () => {
  setupClock()
  pidData = await loadPIDData()
  setInterval(async () => {
    pidData = await loadPIDData()
  }, 1000 * 60)

  displayPIDData()
  // setInterval(() => displayPIDData(), 1000 * 500)
})
