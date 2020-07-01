function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  return mainTime
}

function shortenStoppingType(type) {
  if (type === 'Stops All Stations') return 'Stops All'
  if (type === 'Limited Express') return 'Ltd Express'
  return type
}

function setFullMessageActive(state) {
  if (state) {
    $('.fullMessage').style = 'display: flex;'
    $('.nextDepartures').style = 'display: none;'
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.nextDepartures').style = 'display: block;'
  }
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen</p><p>for Announcements</p>'
  setFullMessageActive(true)
}

function shorternDestination (destination) {
  if (destination === 'Upper Ferntree Gully') return 'Upper F.T Gully'
  if (destination === 'Flemington Racecource') return 'Flemington Races'
  return destination
}

function updateBody(firstTime) {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    let departures = {
      'Up': [],
      'Down': []
    }

    let screenDepartures = []

    body.departures.forEach(departure => {
      departures[departure.trip.direction].push(departure)
    })

    if (departures.Up.length === 0 || departures.Down.length === 0) {
      screenDepartures = [...departures.Up, ...departures.Down].slice(0, 4)
    } else {
      screenDepartures = [...departures.Up.slice(0, 2), ...departures.Down.slice(0, 2)]
    }

    screenDepartures = [...screenDepartures, null, null, null, null].slice(0, 4)

    let departureRows = Array.from(document.querySelectorAll('.departure'))
    let dividerDivs = Array.from(document.querySelectorAll('.greySeparator'))

    screenDepartures.forEach((departure, i) => {
      let departureRow = departureRows[i]
      let dividerDiv = dividerDivs[i]

      if (departure) {
        if (dividerDiv) dividerDiv.style = 'display: block;'
        if (departure.type === 'vline') departureRow.className = 'departure vline'
        else departureRow.className = 'departure'
        departureRow.style = 'display: flex;'
        $('.departureTime', departureRow).textContent = formatTime(new Date(departure.scheduledDepartureTime))
        $('.destination', departureRow).textContent = shorternDestination(departure.destination)

        let stoppingType = shortenStoppingType(departure.stoppingType)
        if (departure.additionalInfo.via) {
          stoppingType += ' ' + departure.additionalInfo.via
        }

        $('.stoppingType', departureRow).textContent = stoppingType
        $('.platform', departureRow).textContent = departure.platform

        if (departure.estimatedDepartureTime) {
          if (departure.minutesToDeparture > 0) {
            $('.timeToDepartureArea .title', departureRow).style = 'display: block;'
            $('.timeToDeparture', departureRow).textContent = departure.minutesToDeparture
            $('.timeToDeparture', departureRow).className = 'timeToDeparture'
          } else {
            $('.timeToDepartureArea .title', departureRow).style = 'display: none;'
            $('.timeToDeparture', departureRow).textContent = 'NOW'
            $('.timeToDeparture', departureRow).className = 'timeToDeparture now'
          }
        } else {
          $('.timeToDepartureArea .title', departureRow).style = 'display: block;'
          $('.timeToDeparture', departureRow).textContent = '--'
          $('.timeToDeparture', departureRow).className = 'timeToDeparture now'
        }
      } else {
        if (dividerDiv) dividerDiv.style = 'display: none;'
        departureRow.className = 'departure'
        departureRow.style = 'display: none;'
      }
    })
  })
}


$.ready(() => {
  setInterval(updateBody, 1000 * 30)
  updateBody(true)
})
