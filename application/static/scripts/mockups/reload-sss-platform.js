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

  mainTime += hours || '00'
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

function setListenAnnouncements() {

}

function setNoDepartures() {

}

function processArrivals(arrivals, platformNumber, isLeft) {
  if (!sssPlatforms[platformNumber]) return
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
    if (destination === 'Flemington Racecource') destination = 'Flemington Races'
    if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'

    arrival.destination = destination.toUpperCase()

    return arrival
  })

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
    if (departure.type === 'vline') {
      if (!departure.platform) return null
      let mainPlatform = departure.platform.replace(/[A-Z]/, '')

      return mainPlatform === platformNumber
    } else {
      return departure.platform === platformNumber
    }
  }).map(departure => {
    let {destination} = departure
    if (destination === 'Flemington Racecource') destination = 'Flemington Races'
    if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'

    departure.destination = destination.toUpperCase()

    return departure
  })

  if (!departures) return setListenAnnouncements()

  let firstDeparture = departures[0]

  let platformContainer = $(`div.${isLeft ? 'left' : 'right'}Platform.platformContainer`)
  if (firstDeparture) {
    $('.topRow .firstDestination', platformContainer).textContent = firstDeparture.destination
    $('.departureData .firstDepartureTime', platformContainer).textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

    if (firstDeparture.minutesToDeparture > 0) {
      if (firstDeparture.minutesToDeparture <= 120)
        $('.departureData div.actual div span.actual', platformContainer).textContent = firstDeparture.minutesToDeparture
      else
        $('.departureData div.actual div span.actual', platformContainer).textContent = '--'
      $('.departureData div.actual div span:nth-child(2)', platformContainer).textContent = 'Min'
    } else {
      $('.departureData div.actual div span.actual', platformContainer).textContent = 'Now'
      $('.departureData div.actual div span:nth-child(2)', platformContainer).textContent = ''
    }
    $('.departureData .platform span:nth-child(2)', platformContainer).textContent = firstDeparture.platform
  }

  let departureCount = sssPlatforms[platformNumber] ? 5 : 9
  let nextDepartures = (departures.slice(1).concat(Array(10).fill(null))).slice(0, departureCount)

  nextDepartures.forEach((departure, i) => {
    let departureRow = $(`.serviceRow:nth-child(${i + 2})`, platformContainer)

    if (departure) {
      departureRow.style = ''
      $('.scheduledDepartureTime', departureRow).textContent = formatTime(new Date(departure.scheduledDepartureTime))
      $('.destination', departureRow).textContent = departure.destination.toUpperCase()
      if (departure.minutesToDeparture <= 120)
        $('.dueIn span.actual', departureRow).textContent = departure.minutesToDeparture
      else
        $('.dueIn span.actual', departureRow).textContent = '--'
      $('.dueIn span:nth-child(2)', departureRow).textContent = 'Min'
      if (sssPlatforms[platformNumber])
        $('.platform', departureRow).textContent = departure.platform
    } else {
      departureRow.style = 'opacity: 0;'
      $('.scheduledDepartureTime', departureRow).textContent = ''
      $('.destination', departureRow).textContent = ''
      $('.dueIn span.actual', departureRow).textContent = ''
      $('.dueIn span:nth-child(2)', departureRow).textContent = ''
      if (sssPlatforms[platformNumber])
        $('.platform', departureRow).textContent = ''
    }
  })
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()
    let departures = body.departures || []
    let arrivals = body.arrivals || []

    processDepartures(departures, platforms[0], true)
    processDepartures(departures, platforms[1], false)

    processArrivals(arrivals, platforms[0], true)
    processArrivals(arrivals, platforms[1], false)
  })
}

$.ready(() => {
  setupClock()

  platforms = location.pathname.split('/').filter(Boolean).slice(-1)[0].split('-')

  updateBody()
  setInterval(updateBody, 1000 * 30)
})
