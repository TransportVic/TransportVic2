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

function setMessagesActive(active) {
  if (active) {
    $('.message').style = 'display: flex;'
    $('.nextDeparture').style = 'display: none;'
  } else {
    $('.message').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
  }
}

function setNoDepartures() {
  $('.message').innerHTML = '<p class="large">No trains departing</p><p class="large"> fromthis platform</p>'
  setMessagesActive(true)
}

function setBusesReplaceTrains() {
  $('.message').innerHTML = '<p>NO TRAINS OPERATING</p><p>REPLACEMENT BUSES</p><p>HAVE BEEN ARRANGED</p>'
  setMessagesActive(true)
}

$.ready(() => {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    departures = body.departures

    let firstDeparture = departures[0]
    if (!firstDeparture) {
      if (body.hasRRB) setBusesReplaceTrains()
      else setNoDepartures()
      return
    }

    $('.firstDestination').textContent = firstDeparture.destination
    $('.scheduledDiv span:nth-child(2)').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

    if (firstDeparture.estimatedDepartureTime) {
      if (firstDeparture.minutesToDeparture > 0) {
        $('.actualDiv div span:nth-child(1)').textContent = firstDeparture.minutesToDeparture
        $('.actualDiv div span:nth-child(2)').textContent = 'min'
      } else {
        $('.actualDiv div span:nth-child(1)').textContent = 'NOW'
        $('.actualDiv div span:nth-child(2)').textContent = ''
      }
    }

    for (let stop of firstDeparture.additionalInfo.screenStops.slice(1)) {
      if (stop.isExpress)
        $('.stops').innerHTML += '<p>&nbsp;&nbsp;---</p>'
      else
        $('.stops').innerHTML += `<p>${stop.stopName}</p>`
    }

    setMessagesActive(false)
  })

  setInterval(() => {
    $('div.timeContainer span').textContent = formatTime(new Date())
  }, 1000)
})
