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
    setFullMessageActive(true)
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

function setFullMessageActive(active) {
  if (active) {
    $('.fullMessage').style = 'display: flex;'
    $('.content').style = 'display: none;'
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.content').style = 'display: flex;'
    currentlyDisplaying = ''
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

  return false
}

let stopScrolling = false
let connectionsScrollTimeout

function updateBody(firstTime) {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
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

      $('.firstDepartureInfo .platform').className = 'platform ' + firstDepartureClass
      $('.firstDepartureInfo .platform').textContent = firstDeparture.plt
      $('.firstDepartureInfo .firstDepartureTime').textContent = formatTimeA(new Date(firstDeparture.sch))
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

      $('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass

      let nextDepartures = (departures.slice(1).concat([null, null, null, null])).slice(0, 4)
      nextDepartures.forEach((departure, i) => {
        let departureRow = $(`.nextDeparture:nth-child(${1 + i})`)
        if (!departure) {
          departureRow.className = 'nextDeparture'
          $('.lineColour', departureRow).className = 'lineColour no-line'
          $('.scheduledDepartureTime', departureRow).textContent = '--'
          $('.destination', departureRow).textContent = '--'
          $('.platform', departureRow).className = 'platform no-line'
          $('.minutesToDeparture span', departureRow).textContent = '-- min'
        } else {
          let actualDepartureTime = new Date(departure.est || departure.sch)

          let departureClass = encode(departure.route)
          if (departure.v) {
            departureClass = 'vline'
            departureRow.className = 'nextDeparture vline'
          } else {
            departureRow.className = 'nextDeparture'
          }

          let destination = departure.dest

          if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
          if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

          $('.lineColour', departureRow).className = 'lineColour ' + departureClass
          $('.scheduledDepartureTime', departureRow).textContent = formatTimeA(new Date(departure.sch))
          $('.destination', departureRow).textContent = destination
          $('.platform span', departureRow).textContent = departure.plt
          $('.platform', departureRow).className = 'platform ' + departureClass
          $('.minutesToDeparture span', departureRow).textContent = minutesToDeparture(actualDepartureTime, true)
        }
      })
    } catch (e) {
      console.log(e)
      setListenAnnouncements()
    }
  })
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

let shiftWidth
let connectionsP

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
    connectionsP.scrollLeft = xPosition
    await asyncPause(20)
  }

  await asyncPause(2000)
  connectionsP.scrollLeft = 0
}

function scrollConnections() {
  if (stopScrolling) return

  connectionsWidth = parseInt(getComputedStyle(connectionsP).width)
  connectionsSize = connectionsP.scrollWidth - connectionsP.clientWidth

  if (connectionsP.scrollWidth < connectionsWidth) {
    return
  }

  connectionsScrollTimeout = setTimeout(async () => {
    scrollConnections(await animateScrollingText())
  }, 2000)
}

$.loaded(() => {
  setTimeout(() => {
    shiftWidth = getComputedStyle(document.body).getPropertyValue('width').slice(0, -2) / 150 // px
    connectionsP = $('p.firstStoppingType')

    updateBody(true)
    setTimeout(() => {
      updateBody()
      setInterval(updateBody, 1000 * 30)
    }, 30000 - (+new Date() % 30000))
  }, 500)
})
