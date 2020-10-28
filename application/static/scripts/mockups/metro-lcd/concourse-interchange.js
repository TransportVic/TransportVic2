let destinations

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

function setFullMessageActive(state) {
  if (state) {
    $('.fullMessage').style = 'display: flex;'
    $('.content').style = 'display: none;'
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.content').style = 'display: flex;'
  }
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
  setFullMessageActive(true)
}

function identifyTargetStop(departure, target, stationName) {
  let targetStop = departure.stopTimings.find(stop => stop.stopName === target)

  let actualDepartureTime = new Date(departure.actualDepartureTime)
  let scheduledDepartureTime = new Date(departure.scheduledDepartureTime)

  let currentStop = departure.stopTimings.find(stop => stop.stopName === stationName)
  let currentMinutes = currentStop.departureTimeMinutes
  let targetMinutes = targetStop.arrivalTimeMinutes

  let minutesDifference = targetMinutes - currentMinutes

  let targetActualTime = new Date(+actualDepartureTime + minutesDifference * 1000 * 60)

  departure.targetActualTime = targetActualTime

  return departure
}

function updateDestinations(departures, stationName) {
  destinations.forEach(destination => {
    let {targets, not, id, count, allowVLine} = destination
    let lastTarget = targets.slice(-1)[0]

    let departureRow = $('#' + id)

    let nextDepartures = departures.filter(departure => {
      if (departure.type === 'vline' && !allowVLine) return false
      for (let target of targets) {
        if (!departure.stopTimings.find(stop => stop.stopName === target))
          return false
      }
      if (not) {
        for (let excluded of not)
          if (departure.stopTimings.find(stop => stop.stopName === excluded))
            return false
      }

      return true
    }).map(departure => {
      return identifyTargetStop(departure, lastTarget, stationName)
    }).sort((a, b) => a.targetActualTime - b.targetActualTime).slice(0, count)
    // }).slice(0, count)

    $('.nextDepartures', departureRow).className = 'nextDepartures departure-' + count + '-' + nextDepartures.length

    let departureDivs = Array.from(departureRow.querySelectorAll('.departure', departureRow))
    let dividerDivs = Array.from(departureRow.querySelectorAll('.divider', departureRow))

    let screenDepartures = [...nextDepartures, ...Array(count).fill(null)].slice(0, count)
    screenDepartures.forEach((departure, i) => {
      let departureDiv = departureDivs[i]
      let dividerDiv = dividerDivs[i - 1]

      if (departure) {
        $('.platform', departureDiv).textContent = departure.platform
        $('.minutesToDeparture', departureDiv).textContent = departure.prettyTimeToDeparture

        departureDiv.style = 'display: flex;'
        if (dividerDiv) dividerDiv.style = 'display: block;'
      } else {
        departureDiv.style = 'display: none;'
        if (dividerDiv) dividerDiv.style = 'display: none;'
      }
    })
  })
}


function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()
    setFullMessageActive(false)

    try {
      updateDestinations(body.departures, body.stationName)
    } catch (e) {
      console.error(e)
      setListenAnnouncements()
    }
  })
}

$.ready(() => {
  setupClock()

  let destinationsURL = location.href
  if (!destinationsURL.endsWith('/')) destinationsURL += '/'
  destinationsURL += 'destinations'

  $.ajax({
    method: 'GET',
    url: destinationsURL
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    destinations = body

    updateBody()
    setTimeout(() => {
      updateBody()
      setInterval(updateBody, 1000 * 30)
    }, 30000 - (+new Date() % 30000))
  })
})
