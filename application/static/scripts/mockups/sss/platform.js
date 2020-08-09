let platforms
let sssPlatforms = {
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
  6: true,
  7: true,
  8: true,
  9: false,
  10: false,
  11: false,
  12: false,
  13: false,
  14: false,
  15: true,
  16: true
}

function formatTime(time, includeSeconds=false, space=false) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let seconds = time.getSeconds()
  let mainTime = ''

  if (hours < 10) mainTime += '0'
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

function setMessageActive(left, active) {
  let container = $(`.platformContainer.${left ? 'left' : 'right'}Platform`)
  if (active) {
    $('.platformData', container).style = 'display: none;'
    $('.fullMessage', container).style = 'display: flex;'
  } else {
    $('.platformData', container).style = 'display: block;'
    $('.fullMessage', container).style = 'display: none;'
  }
}

function setListenAnnouncements(left) {
  let container = $(`.platformContainer.${left ? 'left' : 'right'}Platform`)
  let fullMessage = $('.fullMessage', container)
  fullMessage.innerHTML = '<p>LISTEN</p><p>FOR</p><p>ANNOUNCEMENT</p>'
  setMessageActive(left, true)
}

function setNoDepartures(left) {
  let container = $(`.platformContainer.${left ? 'left' : 'right'}Platform`)
  let fullMessage = $('.fullMessage', container)
  fullMessage.innerHTML = '<p>NO TRAINS</p><p>DEPART</p><p>FROM THIS</p><p>PLATFORM</p>'
  setMessageActive(left, true)
}

function processArrivals(arrivals, platformNumber, isLeft) {
  if (!sssPlatforms[platformNumber]) return true
  arrivals = arrivals.filter(arrival => {
    if (arrival.type === 'vline') {
      if (!arrival.platform) return null
      let mainPlatform = arrival.platform.replace(/[A-Z]/, '')

      return mainPlatform === platformNumber
    } else {
      return arrival.platform === platformNumber
    }
  }).map(arrival => {
    let {destination} = arrival
    if (destination === 'Flemington Racecourse') destination = 'Flemington Races'
    if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'

    arrival.destination = destination.toUpperCase()

    return arrival
  })
  if (!arrivals.length) return true

  let platformContainer = $(`div.${isLeft ? 'left' : 'right'}Platform.platformContainer`)

  let nextArrivals = (arrivals.concat(Array(3).fill(null))).slice(0, 3)

  nextArrivals.forEach((arrival, i) => {
    let arrivalRow = $(`.serviceRow:nth-child(${i + 8})`, platformContainer)

    if (arrival) {
      arrivalRow.style = ''
      $('.scheduledDepartureTime', arrivalRow).textContent = formatTime(new Date(arrival.destinationArrivalTime))
      $('.destination', arrivalRow).textContent = arrival.origin.toUpperCase()
      if (arrival.minutesToDeparture)
        $('.dueIn span.actual', arrivalRow).textContent = arrival.minutesToDeparture
      else
        $('.dueIn span.actual', arrivalRow).textContent = '--'
      $('.dueIn span:nth-child(2)', arrivalRow).textContent = 'Min'
      if (sssPlatforms[platformNumber])
        $('.platform', arrivalRow).textContent = arrival.platform
    } else {
      arrivalRow.style = 'opacity: 0;'
      $('.scheduledDepartureTime', arrivalRow).textContent = ''
      $('.destination', arrivalRow).textContent = ''
      $('.dueIn span.actual', arrivalRow).textContent = ''
      $('.dueIn span:nth-child(2)', arrivalRow).textContent = ''
      if (sssPlatforms[platformNumber])
        $('.platform', arrivalRow).textContent = ''
    }
  })
}

function processDepartures(departures, platformNumber, isLeft) {
  departures = departures.filter(departure => {
    if (departure.type === 'vline' || departure.type === 'NOT IN SERVICE') {
      if (!departure.platform) return null
      let mainPlatform = departure.platform.replace(/[A-Z]/, '')

      return mainPlatform === platformNumber
    } else {
      return departure.platform === platformNumber
    }
  }).map(departure => {
    let {destination} = departure
    if (destination === 'Flemington Racecourse') destination = 'Flemington Races'
    if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
    if (destination === 'South Kensington') destination = 'Sth Kensington'

    departure.destination = destination.toUpperCase()

    if (departure.type === 'NOT IN SERVICE') {
      departure.destination = 'NOT IN SERVICE'
      departure.connections = []
      departure.actualDepartureTime = departure.formingDepartureTime
      departure.scheduledDepartureTime = departure.formingDepartureTime
    }

    return departure
  })

  if (!departures.length) return true
  setMessageActive(isLeft, false)

  departures = departures.sort((a, b) => new Date(a.actualDepartureTime) - new Date(b.actualDepartureTime))
  let firstDeparture = departures[0]

  let platformContainer = $(`div.${isLeft ? 'left' : 'right'}Platform.platformContainer`)
  if (firstDeparture) {
    let message = []
    if (firstDeparture.type === 'NOT IN SERVICE') {
      message = ['TRAIN NOT TAKING PASSENGERS']
    } else if (firstDeparture.connections.length) {
      message = firstDeparture.connections.map(e => `CHANGE AT ${e.changeAt.slice(0, -16).toUpperCase()} FOR ${e.for.slice(0, -16).toUpperCase()}`)
    } else {
      if (firstDeparture.type === 'vline') {
        if (firstDeparture.divideInfo) {
          message = [firstDeparture.divideInfo.first]
        } else {
          let stoppingPattern = ''
          if (firstDeparture.sssStoppingPattern !== 'STOPPING ALL STATIONS') stoppingPattern = firstDeparture.sssStoppingPattern
          if (firstDeparture.viaText)
            message = [firstDeparture.viaText, stoppingPattern]
          else
            message = [stoppingPattern]
        }

      } else {
        if (firstDeparture.viaText.includes('AND') || firstDeparture.sssStoppingPattern !== 'STOPPING ALL STATIONS') {
          message = [firstDeparture.viaText, firstDeparture.sssStoppingPattern]
        } else {
          if (firstDeparture.destination === 'FLINDERS STREET')
            message = [firstDeparture.viaText]
          else if (firstDeparture.destination === 'NORTH MELBOURNE')
            message = ['VIA NTH MELBOURNE TO NTH MELBOURNE', 'STOPPING ALL STATIONS']
          else
            message = [firstDeparture.viaText + ', ' + firstDeparture.sssStoppingPattern]
        }
      }
    }

    $('.topRow .firstDestination', platformContainer).textContent = firstDeparture.destination
    $('.departureData .firstDepartureTime', platformContainer).textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

    if (firstDeparture.minutesToDeparture !== null && firstDeparture.minutesToDeparture <= 90) {
      if (firstDeparture.minutesToDeparture > 0) {
        $('.departureData div.actual div span.actual', platformContainer).textContent = firstDeparture.minutesToDeparture
        $('.departureData div.actual div span:nth-child(2)', platformContainer).textContent = 'Min'
      } else {
        $('.departureData div.actual div span.actual', platformContainer).textContent = 'Now'
        $('.departureData div.actual div span:nth-child(2)', platformContainer).textContent = ''
      }
    } else {
      $('.departureData div.actual div span.actual', platformContainer).textContent = '--'
      $('.departureData div.actual div span:nth-child(2)', platformContainer).textContent = 'Min'
    }
    $('.departureData .platform span:nth-child(2)', platformContainer).textContent = firstDeparture.platform
    $('.bottom .message', platformContainer).innerHTML = message.map(e => `<p>${e}</p>`).join('')
  }


  let offset = 0
  let length = departures.length
  for (let i = 1; i < length; i++) {
    let departure = departures[i + offset]
    departure.connections.forEach(connection => {
      offset += 1
      let newDeparture = JSON.parse(JSON.stringify(departure))
      newDeparture.type = 'CONNECTION'
      newDeparture.message = [`TAKE ${connection.from.slice(0, -16).toUpperCase()} TRAIN`, `AND CHANGE AT ${connection.changeAt.slice(0, -16).toUpperCase()}`]
      newDeparture.destination = connection.for.slice(0, -16)
      departures = [...departures.slice(0, i + offset), newDeparture, ...departures.slice(i + offset)]
    })
  }

  let departureCount = sssPlatforms[platformNumber] ? 5 : 9
  let nextDepartures = (departures.slice(1).concat(Array(10).fill(null))).slice(0, departureCount)

  nextDepartures.forEach((departure, i) => {
    let departureRow = $(`.serviceRow:nth-child(${i + 2})`, platformContainer)

    if (departure) {
      let message = []

      if (departure.type === 'NOT IN SERVICE') {
        departure.destination = 'NOT IN SERVICE'
        departure.scheduledDepartureTime = departure.formingDepartureTime
        message = ['TRAIN NOT TAKING', 'PASSENGERS']
      } else if (departure.divideInfo) {
        message = departure.divideInfo.next
      } else if (departure.type === 'CONNECTION') {
        message = departure.message
      } else if (departure.type === 'vline') {
        message = departure.brokenVia
      } else {
        if (departure.destination === 'FLINDERS STREET')
          message = [departure.viaText, '']
        else if (departure.destination === 'NORTH MELBOURNE')
          message = ['VIA NTH MELBOURNE TO NTH', 'MELBOURNE, STOPPING ALL', 'STATIONS']
        else
          message = [departure.viaText,  departure.sssStoppingPattern]
      }

      departureRow.style = ''
      $('.scheduledDepartureTime', departureRow).textContent = formatTime(new Date(departure.scheduledDepartureTime))
      $('.destination', departureRow).textContent = departure.destination.toUpperCase()
      if (departure.minutesToDeparture && departure.minutesToDeparture <= 90)
        $('.dueIn span.actual', departureRow).textContent = departure.minutesToDeparture
      else
        $('.dueIn span.actual', departureRow).textContent = '--'
      $('.dueIn span:nth-child(2)', departureRow).textContent = 'Min'

      $('.message', departureRow).innerHTML = message.map(e => `<p>${e}</p>`).join('')
      if (message.length === 3) $('.message', departureRow).className = 'message small'
      else $('.message', departureRow).className = 'message'

      if (sssPlatforms[platformNumber])
        $('.platform', departureRow).textContent = departure.platform
    } else {
      departureRow.style = 'opacity: 0;'
      $('.scheduledDepartureTime', departureRow).textContent = ''
      $('.destination', departureRow).textContent = ''
      $('.dueIn span.actual', departureRow).textContent = ''
      $('.dueIn span:nth-child(2)', departureRow).textContent = ''

      $('.message', departureRow).innerHTML = ''
      $('.message', departureRow).className = 'message'

      if (sssPlatforms[platformNumber])
        $('.platform', departureRow).textContent = ''
    }
  })
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements(false) || setListenAnnouncements(true)
    let departures = body.departures || []
    let arrivals = body.arrivals || []

    let offArrivals = arrivals.filter(e => e.showDeparture === 'OFF' && e.formingDepartureTime)
    let offDepartures = offArrivals.map(e => {
      e.type = 'NOT IN SERVICE'
      return e
    })

    departures = offDepartures.concat(departures)

    let leftNoDepartures = processDepartures(departures, platforms[0], true)
    let rightNoDepartures = processDepartures(departures, platforms[1], false)

    let leftNoArrivals = processArrivals(arrivals, platforms[0], true)
    let rightNoArrivals = processArrivals(arrivals, platforms[1], false)

    if (leftNoDepartures && leftNoArrivals) setNoDepartures(true)
    if (rightNoDepartures && rightNoArrivals) setNoDepartures(false)
  })
}

$.ready(() => {
  setupClock()

  platforms = location.pathname.split('/').filter(Boolean).slice(-1)[0].split('-')

  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})
