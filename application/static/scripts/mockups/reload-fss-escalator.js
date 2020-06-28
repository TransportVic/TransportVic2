function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  if (time.getHours() >= 12)
    mainTime += 'pm'
  else
    mainTime += 'am'

  return mainTime
}

function createStationRow(name, stoppingType, clazz) {
  return `<div class="stationRow ${stoppingType === 'filler' ? 'filler' : ''}">`
  + `<img src="/static/images/mockups/station-${stoppingType}.svg">`
  + `<p class="${clazz || ''}">${name}</p>`
  + `</div>`
}

let currentlyDisplaying = ''

function setNoDepartures() {
  if (currentlyDisplaying !== 'no-departures') {
    currentlyDisplaying = 'no-departures'
    setMessageActive(true)
    showServiceData(false)
    $('.serviceMessage').innerHTML = '<img src="/static/images/mockups/no-boarding-train.svg" /><p>No trains are departing from this platform</p>'
  }
}

function setArrival() {
  if (currentlyDisplaying !== 'arrival') {
    currentlyDisplaying = 'arrival'
    setMessageActive(true)
    showServiceData(true)
    $('.serviceMessage').innerHTML = '<img src="/static/images/mockups/no-boarding-train.svg" /><p>This train is not taking passengers</p><p>Don\'t board this train</p>'
  }
}

function setListenAnnouncements() {
  if (currentlyDisplaying !== 'announcements') {
    currentlyDisplaying = 'announcements'
    $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
    setFullMessagesActive(true)
  }
}

function showServiceData(active) {
  if (active) {
    $('.firstDepartureInfo').className = 'firstDepartureInfo'
  } else {
    $('.firstDepartureRight .platform').className = 'platform no-line'
    $('.firstDepartureInfo').className = 'firstDepartureInfo messageActive'
  }
}

function setMessageActive(active) {
  if (active) {
    $('.fullMessage').style = 'display: none;'
    $('.content').style = 'display: flex;'
    $('.topLineBanner').className = 'topLineBanner no-line'
    $('.stoppingPattern').innerHTML = '<div class="serviceMessage"></div>'
    currentPattern = ''
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.content').style = 'display: flex;'
    showServiceData(true)
    currentlyDisplaying = ''
  }
}

function setFullMessagesActive(active) {
  if (active) {
    $('.fullMessage').style = 'display: flex;'
    $('.content').style = 'display: none;'
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.content').style = 'display: flex;'
    currentlyDisplaying = ''
  }
}

function blankNextDeparture(departureDIV) {
  $('.sideBar', departureDIV).className = 'sideBar no-line'
  $('.sideBar~p', departureDIV).textContent = '--'

  $('.centre p', departureDIV).textContent = '--'

  $('.right .platform', departureDIV).className = 'platform no-line'
  $('.right .platform p', departureDIV).innerHTML = '&nbsp;'

  $('.right .timeToDeparture p', departureDIV).innerHTML = '&nbsp;'
}


function createStoppingPatternID(stoppingPattern) {
  return stoppingPattern.map(e => `${e.stopName}${e.isExpress}`).join(',')
}

let currentPattern = null

function addStoppingPattern(stops, className) {
  let newPatternID = createStoppingPatternID(stops)
  if (currentPattern === newPatternID) return true

  currentPattern = newPatternID

  let {stopColumns, size} = splitStops(stops, false, {
    MAX_COLUMNS: 2,
    MIN_COLUMN_SIZE: 5,
    MAX_COLUMN_SIZE: 22
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
      let {stopName} = stop
      let type = stop.isExpress ? 'express' : 'stops-at'
      if (lastRow && y === stopColumn.length - 1) type = 'terminates'

      let stopType = x == 0 && y == 0 ? className : ''
      if (stop.isExpress) {
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

  return false
}

function adjustDepartures(departure) {
  if (departure.additionalInfo.notTakingPassengers) {
    departure.destination = 'Arrival'
    departure.stoppingType = 'Not Taking Passengers'
    departure.isArrival = true
  }
  return departure
}

let stopScrolling = false
let connectionsScrollTimeout

function updateBody(firstTime) {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    departures = body.departures
    if (!departures) return setListenAnnouncements()
    departures = departures.map(adjustDepartures)

    let firstDeparture = departures[0]
    if (!firstDeparture) {
      $('.topLineBanner').className = 'topLineBanner no-line'
      return setNoDepartures()
    } else setMessageActive(false)

    let firstDepartureClass = firstDeparture.codedLineName
    if (firstDeparture.type === 'vline') firstDepartureClass = 'vline'

    let {destination} = firstDeparture
    if (destination === 'Flemington Racecource') destination = 'Flemington Races'

    let firstStoppingType = firstDeparture.stoppingType
    if (firstDeparture.additionalInfo.via) {
      firstStoppingType += ' ' + firstDeparture.additionalInfo.via
    }
    if (firstDeparture.connections) {
      firstStoppingType += firstDeparture.connections.map(connection => {
        return `, Change at ${connection.changeAt.slice(0, -16)} for ${connection.for.slice(0, -16)}`
      }).join('')
    }

    $('.firstDepartureInfo .platform').className = 'platform ' + firstDepartureClass
    $('.firstDepartureInfo .firstDepartureTime').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))
    $('.firstDepartureInfo .firstDestination').textContent = destination
    $('.firstDepartureInfo .firstStoppingType').textContent = firstStoppingType
    $('.firstDepartureInfo .minutesToDeparture span').textContent = firstDeparture.prettyTimeToDeparture

    if (firstDeparture.isArrival) {
      setArrival()
    } else {
      $('.stoppingPattern').className = 'stoppingPattern ' + firstDepartureClass
      let same = addStoppingPattern(firstDeparture.additionalInfo.screenStops, firstDepartureClass)

      if (!same) {
        if (!firstTime)
          stopScrolling = true

        clearTimeout(connectionsScrollTimeout)
        scrollConnections()
      }
    }


    $('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass

    let nextDepartures = (departures.slice(1).concat([null, null, null, null])).slice(0, 4)
    nextDepartures.forEach((departure, i) => {
      let departureRow = $(`.nextDeparture:nth-child(${1 + i})`)
      if (!departure) {
        $('.lineColour', departureRow).className = 'lineColour no-line'
        $('.scheduledDepartureTime', departureRow).textContent = '--'
        $('.destination', departureRow).textContent = '--'
        $('.platform', departureRow).className = 'platform no-line'
        $('.minutesToDeparture span', departureRow).textContent = '-- min'
      } else {
        let departureClass = departure.codedLineName
        if (departure.type === 'vline') departureClass = 'vline'

        let {destination} = departure

        if (destination === 'North Melbourne') destination = 'Nth Melbourne'
        if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
        if (destination === 'Flemington Racecource') destination = 'Flemington Races'

        let stoppingType = departure.stoppingType
        if (departure.additionalInfo.via) {
          stoppingType += ' ' + departure.additionalInfo.via
        }

        $('.lineColour', departureRow).className = 'lineColour ' + departureClass
        $('.scheduledDepartureTime', departureRow).textContent = formatTime(new Date(departure.scheduledDepartureTime))
        $('.destination', departureRow).textContent = destination
        $('.platform span', departureRow).textContent = departure.platform
        $('.platform', departureRow).className = 'platform ' + departureClass
        $('.minutesToDeparture span', departureRow).textContent = departure.prettyTimeToDeparture
      }
    })
  })
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

let shiftWidth = getComputedStyle(document.body).getPropertyValue('width').slice(0, -2) / 140 // px
let connectionsP

let connectionsWidth = 0, connectionsSize = 0

async function animateScrollingText() {
  let iterationCount = Math.ceil((connectionsWidth) / shiftWidth)
  let xPosition = shiftWidth

  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling) {
      stopScrolling = false
      return
    }

    xPosition += shiftWidth
    connectionsP.scrollLeft = xPosition
    await asyncPause(15)
  }

  await asyncPause(2000)
  connectionsP.scrollLeft = 0
}

function scrollConnections() {
  if (stopScrolling) return

  connectionsWidth = parseInt(getComputedStyle(connectionsP).width)
  connectionsSize = connectionsP.scrollWidth + connectionsWidth * 0.05

  if (connectionsSize < connectionsWidth) {
    return
  }

  connectionsScrollTimeout = setTimeout(async () => {
    scrollConnections(await animateScrollingText())
  }, 2000)
}

$.ready(() => {
  updateBody(true)
  setInterval(updateBody, 1000 * 30)

  connectionsP = $('p.firstStoppingType')
})
