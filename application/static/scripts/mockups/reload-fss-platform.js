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

function createStationRow(name, stoppingType, clazz) {
  return `<div class="stationRow">`
  + `<img src="/static/images/mockups/station-${stoppingType}.svg">`
  + `<p class="${clazz || ''}">${name}</p>`
  + `</div>`
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

function setMessageActive(active) {
  if (active) {
    $('.message').style = 'display: flex;'
    $('.content').style = 'display: flex;'
    $('.firstDeparture').style = 'display: none;'
    $('.fullMessage').style = 'display: none;'
  } else {
    $('.message').style = 'display: none;'
    $('.content').style = 'display: flex;'
    $('.firstDeparture').style = 'display: flex;'
    $('.fullMessage').style = 'display: none;'
  }
}

function setFullMessageActive(active) {
  if (active) {
    $('.message').style = 'display: none;'
    $('.content').style = 'display: none;'
    $('.firstDeparture').style = 'display: none;'
    $('.fullMessage').style = 'display: flex;'
  } else {
    $('.message').style = 'display: none;'
    $('.content').style = 'display: flex;'
    $('.firstDeparture').style = 'display: flex;'
    $('.fullMessage').style = 'display: none;'
  }
}

function setNoDepartures() {
  $('.message').innerHTML = '<img src="/static/images/mockups/no-boarding-train.svg" /><p>No trains are departing from this platform</p>'
  setMessageActive(true)
}

function setListenAnnouncements() {
  $('.message').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
  setFullMessageActive(true)
}

function addStoppingPattern(stops, className) {
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
      column.innerHTML += createStationRow('', 'stub-2')
    } else {
      for (let i = 0; i < 3; i++)
        column.innerHTML += createStationRow(' ', 'filler-2')
    }

    stopColumn.forEach((stop, y) => {
      let {stopName} = stop
      let type = stop.isExpress ? 'express' : 'stops-at'
      if (lastRow && y === stopColumn.length - 1) type = 'terminates'

      let stopType = x == 0 && y == 0 ? className : ''
      if (stop.isExpress) stopType = 'express'

      column.innerHTML += createStationRow(stopName, type, stopType)
    })

    if (!lastRow) {
      for (let i = 0; i < 5; i++)
        column.innerHTML += createStationRow(' ', 'filler-2')
    }

    $('.stoppingPattern').innerHTML += `
<div class="stopsColumn row-${size} column-${stopColumns.length}">
  ${column.outerHTML}
</div>`
  })
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    departures = body.departures

    let firstDeparture = departures[0]
    if (!firstDeparture) return setNoDepartures()

    let firstDepartureClass = firstDeparture.codedLineName
    if (firstDeparture.type === 'vline') firstDepartureClass = 'vline'

    let {destination} = departure
    if (destination === 'Flemington Racecource') destination = 'Flemington Races'

    $('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass
    $('.firstDepartureInfo .firstDepartureTime').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))
    $('.firstDepartureInfo .firstDestination').textContent = destination
    $('.firstDepartureInfo .firstStoppingType').textContent = firstDeparture.stoppingType
    $('.firstDepartureInfo .minutesToDeparture span').textContent = firstDeparture.prettyTimeToDeparture
    $('.stoppingPattern').className = 'stoppingPattern stoppingAt ' + firstDepartureClass

    addStoppingPattern(firstDeparture.additionalInfo.screenStops, firstDepartureClass)

    let nextDepartures = (departures.slice(1).concat([null, null])).slice(0, 2)
    nextDepartures.forEach((departure, i) => {
      let departureRow = $(`.nextDeparture:nth-child(${2 * i + 1})`)
      if (!departure) {
        $('.lineColour', departureRow).className = 'lineColour no-line'
        $('.scheduledDepartureTime', departureRow).textContent = '--'
        $('.destination', departureRow).textContent = '--'
        $('.stoppingType', departureRow).textContent = '--'
        $('.minutesToDeparture', departureRow).textContent = ''
      } else {
        let departureClass = departure.codedLineName
        if (departure.type === 'vline') departureClass = 'vline'

        let {destination} = departure
        if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
        if (destination === 'Flemington Racecource') destination = 'Flemington Races'

        $('.lineColour', departureRow).className = 'lineColour ' + departureClass
        $('.scheduledDepartureTime', departureRow).textContent = formatTime(new Date(departure.scheduledDepartureTime))
        $('.destination', departureRow).textContent = destination
        $('.stoppingType', departureRow).textContent = departure.stoppingType
        $('.minutesToDeparture span', departureRow).textContent = departure.prettyTimeToDeparture
      }
    })

    setMessageActive(false)
  })
}

$.ready(() => {
  setupClock()

  updateBody()
  setInterval(updateBody, 1000 * 30)
})
