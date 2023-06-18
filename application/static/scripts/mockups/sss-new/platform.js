function setMessagesActive(side, active) {
  let sideDiv = $('.' + side)
  function $$(selector) { return $(selector, sideDiv) }

  if (active) {
    $$('.message').style = 'display: flex;'
    $$('.firstDeparture').style = 'display: none;'
    $$('.stops').style = 'display: none';

    currentPattern[side] = null
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

    currentPattern[side] = null
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

  return stopName
}

function createStoppingPatternID(side, stoppingPattern) {
  return stoppingPattern.map(e => `${e[0]}${e[1]}`).join(',')
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
      let className = stop[1] ? ' class="express"' : ''
      html += `<span${className}>${shorternName(stop[0])}</span><br>`
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
  try {
    let sideDiv = $('.' + side)
    function $$(selector) { return $(selector, sideDiv) }

    let firstDeparture = departures[0]
    if (firstDeparture) {
      setMessagesActive(side, false)

      let firstDepartureClass = encode(firstDeparture.route)
      if (firstDeparture.v) firstDepartureClass = 'vline'

      let firstStoppingType = firstDeparture.type
      if (firstDeparture.via) {
        firstStoppingType += ' via ' + firstDeparture.via
      }

      if (firstDeparture.connections) {
        firstStoppingType += firstDeparture.connections.map(connection => {
          return `, Change at ${connection.changeAt} for ${connection.for}`
        }).join('').replace(/ Railway Station/g, '')
      }

      $$('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass

      $$('.firstDepartureInfo .platform').textContent = firstDeparture.plt
      $$('.firstDepartureInfo .scheduled').textContent = formatTime(new Date(firstDeparture.sch))

      let minutesToDeparture = rawMinutesToDeparture(new Date(firstDeparture.est || firstDeparture.sch))
      if (minutesToDeparture === 0) {
        $$('.firstDepartureInfo .departingDiv .departing').textContent = 'Now'
        $$('.firstDepartureInfo .departingDiv .min').textContent = ''
      } else {
        $$('.firstDepartureInfo .departingDiv .departing').textContent = minutesToDeparture
        $$('.firstDepartureInfo .departingDiv .min').textContent = 'min'
      }

      let destination = shorternName(firstDeparture.dest)
      let destinationClass = 'firstDestination'
      if (destination === 'Sydney Central') destination = 'Sydney XPT'
      if (destination === 'Flemington Races') {
        destinationClass += ' small'
      }

      $$('.firstDeparture .firstDestination').textContent = destination
      $$('.firstDeparture .firstDestination').className = destinationClass

      $$('.firstDeparture .firstStoppingType').textContent = firstStoppingType

      let same = addStoppingPattern(side, firstDeparture.stops)

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
  } catch (e) {
    setFullMessageActive(side, true)
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
  $('.clock span').textContent = formatTime(new Date(), { includeSeconds: 1 })
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
      return
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
  if (stopScrolling[side] || !connectionsSpan) return

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
    shiftWidth = getComputedStyle(document.body).getPropertyValue('width').slice(0, -2) / 250 // px

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
