function createStationRow(name, stoppingType, clazz) {
  return `<div class="stationRow ${stoppingType === 'filler' ? 'filler' : ''}">`
  + `<img src="/static/images/mockups/station-${stoppingType}.svg">`
  + `<p class="${clazz || ''}">${name}</p>`
  + `</div>`
}

function setTime() {
  $('.clock span').textContent = formatTime(new Date(), { includeSeconds: 1, showAMPM: 1, spaceBeforeAMPM: 1 })
}

function setupClock() {
  setTime()
  let msToNextSecond = 1000 - (+new Date() % 1000)
  setTimeout(() => {
    setTime()
    setInterval(setTime, 1000)
  }, msToNextSecond)
}

let currentlyDisplaying = 'service'

function setMessageActive(active) {
  if (active) {
    $('.message').style = 'display: flex;'
    $('.content').style = 'display: flex;'
    $('.firstDeparture').style = 'display: none;'
    $('.fullMessage').style = 'display: none;'
  } else {
    currentlyDisplaying = 'service'
    $('.message').style = 'display: none;'
    $('.content').style = 'display: flex;'
    $('.firstDeparture').style = 'display: flex;'
    $('.fullMessage').style = 'display: none;'
    $('.stoppingPattern').className = 'stoppingPattern'
  }
}

function setFullMessageActive(active) {
  if (active) {
    $('.message').style = 'display: none;'
    $('.content').style = 'display: none;'
    $('.firstDeparture').style = 'display: none;'
    $('.fullMessage').style = 'display: flex;'
  } else {
    currentlyDisplaying = 'service'
    $('.message').style = 'display: none;'
    $('.content').style = 'display: flex;'
    $('.firstDeparture').style = 'display: flex;'
    $('.fullMessage').style = 'display: none;'
    $('.stoppingPattern').className = 'stoppingPattern'
  }
}

function setNoDepartures() {
  if (currentlyDisplaying !== 'no-departures') {
    currentlyDisplaying = 'no-departures'
    $('.message').innerHTML = '<img src="/static/images/mockups/no-boarding-train.svg" /><p>No trains are departing from this platform</p>'
    setMessageActive(true)
  }
}

function setArrival() {
  if (currentlyDisplaying !== 'arrival') {
    $('.stoppingPattern').innerHTML = '<div class="arrivalMessage"><img src="/static/images/mockups/no-boarding-train.svg" /><div><p>This train is not taking passengers</p><p>Don\'t board this train</p></div></div>'
    $('.stoppingPattern').className = 'stoppingPattern arrivalContainer'
    setMessageActive(false)
    currentlyDisplaying = 'arrival'
    currentPattern = ''
  }
}

function setListenAnnouncements() {
  if (currentlyDisplaying !== 'announcements') {
    currentlyDisplaying = 'announcements'
    $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
    setFullMessageActive(true)
  }
}

function createStoppingPatternID(stoppingPattern) {
  return stoppingPattern.map(e => `${e[0]}${e[1]}`).join(',')
}

let currentPattern = null

function addStoppingPattern(stops, className) {
  let newPatternID = createStoppingPatternID(stops) + className
  if (currentPattern === newPatternID) return true

  currentPattern = newPatternID

  let {stopColumns, size} = splitStops(stops, false, {
    MAX_COLUMNS: 4,
    CONNECTION_LOSS: 2,
    MIN_COLUMN_SIZE: 5,
    MAX_COLUMN_SIZE: 11
  })

  $('.stoppingPattern').innerHTML = ''

  stopColumns.forEach((stopColumn, x) => {
    let column = document.createElement('div')
    let lastRow = x + 1 === stopColumns.length

    if (x === 0) {
      column.innerHTML += createStationRow('', 'stub')
    } else {
      for (let i = 0; i < 3; i++)
        column.innerHTML += createStationRow(' ', 'filler')
    }

    let expresses = []
    let expressPart = []

    stopColumn.forEach((stop, y) => {
      let [stopName, express] = stop
      let type = express ? 'express' : 'stops-at'
      if (lastRow && y === stopColumn.length - 1) type = 'terminates'

      let stopType = x == 0 && y == 0 ? className : ''
      if (express) {
        stopType = 'express'
        expressPart.push(y)
      } else {
        if (expressPart.length) {
          expresses.push(expressPart)
          expressPart = []
        }
      }

      column.innerHTML += createStationRow(stopName, type, stopType)
    })

    if (expressPart.length) {
      expresses.push(expressPart)
      expressPart = []
    }

    if (!lastRow) {
      for (let i = 0; i < 5; i++)
        column.innerHTML += createStationRow(' ', 'filler')
    }

    expresses.forEach(express => {
      if (express.length === 1) return
      let firstStop = express[0], lastStop = express.slice(-1)[0]
      let columnSize = stopColumn.length
      if (lastRow) columnSize--

      let startingBottom = columnSize - firstStop
      let endingBottom = columnSize - lastStop - 2

      let middle = (startingBottom + endingBottom) / 2

      let extra = ''
      if (!lastRow) {
        extra = `+ var(--row-height) * 0.1 / 2`
      }

      let marginTop = `calc(var(--arrow-height) * -1.333 / 0.5593 - var(--row-height) * ${middle} / 1.1 ${extra})`

      column.innerHTML += `<div class="expressArrow" style="margin-top: ${marginTop}">
        <img src="/static/images/mockups/express-arrow.svg" class="${className}"/>
        <img src="/static/images/mockups/express-arrow.svg"/>
      </div>`
    })

    $('.stoppingPattern').innerHTML += `
<div class="stopsColumn row-${size} column-${stopColumns.length}">
  ${column.outerHTML}
</div>`
  })
}

let stopScrolling = false
let connectionsScrollTimeout
let firstTime = true

function getData(callback) {
  $.ajax({
    method: 'POST',
    data: {
      csrf: $('[name=csrf]').value
    }
  }, (err, status, body) => {
    callback(err, body)
  })
}

function updateBody(err, body) {
  if (err) return setListenAnnouncements()

  try {
    departures = body.dep
    if (!departures) return setListenAnnouncements()

    let firstDeparture = departures[0]
    if (!firstDeparture) {
      $('.topLineBanner').className = 'topLineBanner no-line'
      return setNoDepartures()
    } else setMessageActive(false)

    let firstDepartureClass = encode(firstDeparture.route)
    if (firstDeparture.v) firstDepartureClass = 'vline'

    let destination = firstDeparture.dest
    if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
    if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

    let firstStoppingType = firstDeparture.type
    if (firstDeparture.via) {
      firstStoppingType += ' via ' + firstDeparture.via
    }

    if (firstDeparture.connections) {
      firstStoppingType += firstDeparture.connections.map(connection => {
        return `, Change at ${connection.changeAt.replace(' Railway Station', '')} for ${connection.for.replace(' Railway Station', '')}`
      }).join('')
    }

    let actualDepartureTime = new Date(firstDeparture.est || firstDeparture.sch)

    $('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass
    $('.firstDepartureInfo .firstDepartureTime').textContent = formatTime(new Date(firstDeparture.sch), { showAMPM: 1 })
    $('.firstDepartureInfo .firstDestination').textContent = destination
    $('.firstDepartureInfo .firstStoppingType').textContent = firstStoppingType.replace('Limited', 'Ltd')
    $('.firstDepartureInfo .minutesToDeparture span').textContent = minutesToDeparture(actualDepartureTime, true)

    if (destination === 'Arrival' || !firstDeparture.p) {
      setArrival()
    } else {
      $('.stoppingPattern').className = 'stoppingPattern ' + firstDepartureClass
      let same = addStoppingPattern(firstDeparture.stops, firstDepartureClass)

      if (!same) {
        if (!firstTime)
          stopScrolling = true

        clearTimeout(connectionsScrollTimeout)
        setTimeout(() => {
          stopScrolling = false
          scrollConnections()
        }, 30)
      }
    }

    let nextDepartures = (departures.slice(1).concat([null, null])).slice(0, 2)
    nextDepartures.forEach((departure, i) => {
      let departureRow = $(`.nextDeparture:nth-child(${2 * i + 1})`)
      if (!departure) {
        $('.lineColour', departureRow).className = 'lineColour no-line'
        $('.scheduledDepartureTime', departureRow).textContent = '--'
        $('.destination', departureRow).textContent = '--'
        $('.stoppingType', departureRow).textContent = '--'
        $('.minutesToDeparture span', departureRow).textContent = '-- min'
      } else {
        let actualDepartureTime = new Date(departure.est || departure.sch)

        let departureClass = encode(departure.route)
        if (departure.v) departureClass = 'vline'

        let destination = departure.dest

        let destinationClass = 'destination'

        if (destination === 'North Melbourne') destinationClass += ' small'
        if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
        if (destination === 'Flemington Racecourse') {
          destination = 'Flemington Races'
          destinationClass += ' small'
        }

        let stoppingType = departure.type
        if (departure.via) {
          stoppingType += ' via ' + departure.via
        }

        $('.lineColour', departureRow).className = 'lineColour ' + departureClass
        $('.scheduledDepartureTime', departureRow).textContent = formatTime(new Date(departure.sch), { showAMPM: 1 })
        $('.destination', departureRow).textContent = destination
        $('.destination', departureRow).className = destinationClass
        $('.stoppingType', departureRow).textContent = stoppingType.replace('Limited', 'Ltd')
        $('.minutesToDeparture span', departureRow).textContent = minutesToDeparture(actualDepartureTime, true)
      }
    })
  } catch (e) {
    setListenAnnouncements()
  } finally {
    firstTime = false
  }
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

let shiftWidth
let connectionsSpan

let connectionsWidth = 0, connectionsSize = 0

async function animateScrollingText() {
  let iterationCount = Math.ceil((connectionsSize) / shiftWidth)
  let xPosition = shiftWidth

  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling) {
      stopScrolling = false
      return
    }

    xPosition += shiftWidth
    connectionsSpan.scrollLeft = xPosition
    await asyncPause(20)
  }

  await asyncPause(2000)
  connectionsSpan.scrollLeft = 0
}

function scrollConnections() {
  if (stopScrolling) return

  connectionsWidth = parseInt(getComputedStyle(connectionsSpan).width)
  connectionsSize = connectionsSpan.scrollWidth - connectionsSpan.clientWidth

  if (connectionsSpan.scrollWidth < connectionsWidth) {
    return
  }

  connectionsScrollTimeout = setTimeout(async () => {
    scrollConnections(await animateScrollingText())
  }, 2000)
}

$.loaded(() => {
  setTimeout(() => {
    shiftWidth = getComputedStyle(document.body).getPropertyValue('width').slice(0, -2) / 150 // px
    connectionsSpan = $('span.firstStoppingType')

    if (window.parent !== window && window.parent.location.host.includes('transportvic')) {
      window.parent.postMessage({
        type: 'init',
        platform: $('[name=platform]').value,
        pidType: 'fss/platform',
        csrf: $('[name=csrf]').value,
        urlPattern: '/mockups/fss/platform/*/{station}'
      }, location.origin)

      window.addEventListener('message', event => {
        if (event.origin !== location.origin) return
        if (event.data.type !== 'departure-data') return

        updateBody(event.data.err, event.data.body)
      })
    } else {
      getData(updateBody)
      setTimeout(() => {
        getData(updateBody)
        setInterval(() => getData(updateBody), 1000 * 30)
      }, 30000 - (+new Date() % 30000))
    }
  }, 500)
})

$.ready(() => {
  setupClock()
})
