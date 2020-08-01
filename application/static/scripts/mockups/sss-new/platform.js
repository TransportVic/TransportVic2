function formatTime(time, includeSeconds=false, space=false) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let seconds = time.getSeconds()
  let mainTime = ''

  mainTime += hours
  mainTime += ':'

  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  if (includeSeconds) {
    mainTime += ':'

    if (seconds < 10) mainTime += '0'
    mainTime += seconds
  }

  return mainTime
}

function setMessagesActive(side, active) {
  let sideDiv = $('.' + side)
  function $$(selector) { return $(selector, sideDiv) }

  if (active) {
    $$('.message').style = 'display: flex;'
    $$('.firstDeparture').style = 'display: none;'
    $$('.stops').style = 'display: none';
  } else {
    $$('.message').style = 'display: none;'
    $$('.firstDeparture').style = 'display: flex;'
    $$('.stops').style = 'display: flex;'
  }

  $$('.fullMessage').style = 'display: none;'
}

function setFullMessageActive(side, active) {
  let sideDiv = $('.' + side)
  function $$(selector) { return $(selector, sideDiv) }

  if (active) {
    $$('.fullMessage').style = 'display: flex;'
    $$('.firstDeparture').style = 'display: none;'
    $$('.stops').style = 'display: none;'
  } else {
    $$('.fullMessage').style = 'display: none;'
    $$('.firstDeparture').style = 'display: flex;'
    $$('.stops').style = 'display: flex'
  }
  $$('.message').style = 'display: none;'
}

function setNoDepartures(side) {
  $(`.${side} .message`).innerHTML = '<p class="large">No trains departing</p><p class="large"> from this platform</p>'
  setMessagesActive(side, true)
}

function shorternName(stopName) {
  if (stopName === 'Upper Ferntree Gully') return 'Upper F.T Gully'
  if (stopName === 'North Melbourne') return 'Nth Melbourne'
  if (stopName === 'South Kensington') return 'Sth Kensington'
  if (stopName === 'Flemington Racecourse') return 'Flemington Races'
  if (stopName === 'Flinders Street') return 'Flinders St'

  return stopName
}

function createStoppingPatternID(side, stoppingPattern) {
  return stoppingPattern.map(e => `${e.stopName}${e.isExpress}`).join(',')
}

let currentPattern = { left: null, right: null }

function addStoppingPattern(side, stops) {
  let newPatternID = createStoppingPatternID(side, stops)
  if (currentPattern[side] === newPatternID) return true

  currentPattern[side] = newPatternID
  let {stopColumns, size} = splitStops(stops, false, {
    MAX_COLUMNS: 3,
    CONNECTION_LOSS: 2,
    MIN_COLUMN_SIZE: 5,
    MAX_COLUMN_SIZE: 17
  })

  let selector = `.${side} .stops`

  $(selector).innerHTML = ''

  let check = []

  stopColumns.forEach((stopColumn, i) => {
    let outerColumn = document.createElement('div')
    let html = ''

    stopColumn.forEach(stop => {
      let className = stop.isExpress ? ' class="express"' : ''
      html += `<span${className}>${shorternName(stop.stopName)}</span><br>`
    })

    outerColumn.innerHTML = `<div>${html}</div>`
    outerColumn.className = `stopsColumn columns-${size}`

    $(selector).appendChild(outerColumn)

    check.push($('div', outerColumn))
  })

  setTimeout(() => {
    check.forEach(container => {
      let computed = getComputedStyle(container.parentElement)
      let containerWidth = parseFloat(computed.width) + 0.3 * parseFloat(computed.marginRight)
      let threshold = containerWidth * 0.9

      Array.from(container.children).forEach(station => {
        if (station.tagName === 'BR') return

        let childWidth = parseFloat(getComputedStyle(station).width)
        if (childWidth >= threshold) {
          station.className = 'squish'
        }
      })
    })
  }, 1)
}

function processDepartures(departures, side, firstTime) {
  let sideDiv = $('.' + side)
  function $$(selector) { return $(selector, sideDiv) }

  let firstDeparture = departures[0]
  if (firstDeparture) {
    setMessagesActive(side, false)

    let firstDepartureClass = firstDeparture.codedLineName
    if (firstDeparture.type === 'vline') firstDepartureClass = 'vline'

    let {destination} = firstDeparture

    let firstStoppingType = firstDeparture.stoppingType
    if (firstDeparture.additionalInfo.via) {
      firstStoppingType += ' ' + firstDeparture.additionalInfo.via
    }

    if (firstDeparture.connections) {
      firstStoppingType += firstDeparture.connections.map(connection => {
        return `, Change at ${connection.changeAt.slice(0, -16)} for ${connection.for.slice(0, -16)}`
      }).join('')
    }

    $$('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass

    $$('.firstDepartureInfo .platform').textContent = firstDeparture.platform
    $$('.firstDepartureInfo .scheduled').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

    if (firstDeparture.minutesToDeparture === 0) {
      $$('.firstDepartureInfo .departingDiv .departing').textContent = 'Now'
      $$('.firstDepartureInfo .departingDiv .min').textContent = ''
    } else {
      $$('.firstDepartureInfo .departingDiv .departing').textContent = firstDeparture.minutesToDeparture || '-- '
      $$('.firstDepartureInfo .departingDiv .min').textContent = 'min'
    }

    $$('.firstDeparture .firstDestination').textContent = shorternName(destination)
    $$('.firstDeparture .firstStoppingType').textContent = firstStoppingType

    let same = addStoppingPattern(side, firstDeparture.additionalInfo.screenStops)

    if (!same) {
      if (!firstTime)
        stopScrolling[side] = true

      clearTimeout(connectionsScrollTimeout[side])
      setTimeout(() => {
        stopScrolling[side] = false
        scrollConnections(side, $$('.firstDeparture .firstStoppingType'))
      }, 30)
    }
  } else {
    setNoDepartures(side)
  }
}

function updateBody(firstTime) {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) {
      setFullMessageActive('left', true)
      setFullMessageActive('right', true)
      return
    }

    processDepartures(body.left, 'left', firstTime)
    processDepartures(body.right, 'right', firstTime)
  })
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

let shiftWidth
let stopScrolling = { left: false, right: false }
let connectionsScrollTimeout = { left: 0, right: 0 }

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

async function animateScrollingText(side, connectionsSpan, connectionsSize) {
  let iterationCount = Math.ceil((connectionsSize) / shiftWidth)
  let xPosition = shiftWidth

  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling[side]) {
      stopScrolling[side] = false
      return connectionsSpan
    }

    xPosition += shiftWidth
    connectionsSpan.scrollLeft = xPosition
    await asyncPause(20)
  }

  await asyncPause(2000)
  connectionsSpan.scrollLeft = 0

  return connectionsSpan
}

function scrollConnections(side, connectionsSpan) {
  if (stopScrolling[side]) return

  let connectionsWidth = parseInt(getComputedStyle(connectionsSpan).width)
  let connectionsSize = connectionsSpan.scrollWidth - connectionsSpan.clientWidth

  if (connectionsSpan.scrollWidth < connectionsWidth) {
    return
  }

  connectionsScrollTimeout[side] = setTimeout(async () => {
    scrollConnections(side, await animateScrollingText(side, connectionsSpan, connectionsSize))
  }, 2000)
}

$.loaded(() => {
  setTimeout(() => {
    shiftWidth = getComputedStyle(document.body).getPropertyValue('width').slice(0, -2) / 200 // px

    updateBody(true)
    setTimeout(() => {
      updateBody()
      setInterval(updateBody, 1000 * 30)
    }, 30000 - (+new Date() % 30000))
  }, 500)
})

$.ready(() => {
  setupClock()
})
