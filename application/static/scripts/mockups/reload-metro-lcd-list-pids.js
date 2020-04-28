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
    $('.fullMessage').style = 'display: none;'
    $('.nextDeparture').style = 'display: none;'
    $('.left').style = 'display: block;'
    $('.right').style = 'display: block;'
  } else {
    $('.message').style = 'display: none;'
    $('.fullMessage').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.left').style = 'display: block;'
    $('.right').style = 'display: block;'
  }
}

function setFullMessageActive(active) {
  if (active) {
    $('.message').style = 'display: none;'
    $('.fullMessage').style = 'display: flex;'
    $('.left').style = 'display: none;'
    $('.right').style = 'display: none;'
  } else {
    $('.message').style = 'display: none;'
    $('.fullMessage').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.left').style = 'display: block;'
    $('.right').style = 'display: block;'
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

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
  setFullMessageActive(true)
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) {
      return setListenAnnouncements()
    }

    departures = body.departures

    let firstDeparture = departures[0]
    if (!firstDeparture) {
      if (body.hasRRB) setBusesReplaceTrains()
      else setNoDepartures()
      return
    }

    $('.firstDestination').textContent = firstDeparture.destination
    $('.scheduledDiv span:nth-child(2)').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

    if (firstDeparture.type === 'vline') {
      $('.departureInfo').className = 'departureInfo vline'
    } else {
      $('.departureInfo').className = 'departureInfo'
    }

    if (firstDeparture.estimatedDepartureTime) {
      if (firstDeparture.minutesToDeparture > 0) {
        $('.actualDiv div span:nth-child(1)').textContent = firstDeparture.minutesToDeparture
        $('.actualDiv div span:nth-child(2)').textContent = 'min'
      } else {
        $('.actualDiv div span:nth-child(1)').textContent = 'NOW'
        $('.actualDiv div span:nth-child(2)').textContent = ''
      }
    }

    let {stopColumns, size} = splitStops(firstDeparture.additionalInfo.screenStops.slice(1), false, {
      MAX_COLUMNS: 4,
      CONNECTION_LOSS: 2,
      MIN_COLUMN_SIZE: 5,
      MAX_COLUMN_SIZE: 9
    })

    $('.stops').innerHTML = ''

    stopColumns.forEach(stopColumn => {
      let column = document.createElement('div')

      let hasStop = false

      stopColumn.forEach(stop => {
        if (stop.isExpress)
          column.innerHTML += '<p>&nbsp;&nbsp;---</p>'
        else {
          column.innerHTML += `<p>${stop.stopName}</p>`
          hasStop = true
        }
      })

      $('.stops').innerHTML += `
  <div class="stopsColumn columns-${size}${hasStop ? '' : ' expressRow'}">
  ${column.outerHTML}
  </div>
  `
    })


    let nextDepartures = [...departures.slice(1, 4), null, null, null].slice(0, 3)
    nextDepartures.forEach((departure, i) => {
      let div = $(`div.followingDeparture:nth-child(${i + 2})`)
      if (departure) {
        $('.scheduled', div).textContent = formatTime(new Date(departure.scheduledDepartureTime))
        $('.destination', div).textContent = departure.destination
        $('.actual', div).textContent = departure.minutesToDeparture
        $('.stoppingType', div).textContent = departure.stoppingType

        if (departure.type === 'vline') {
          div.className = 'followingDeparture vline'
        } else {
          div.className = 'followingDeparture'
        }
      } else {
        $('.scheduled', div).textContent = '--'
        $('.destination', div).textContent = '--'
        $('.actual', div).textContent = '--'
        $('.stoppingType', div).textContent = ''
      }
    })

    setMessagesActive(false)
  })
}

$.ready(() => {
  setInterval(updateBody, 1000 * 30)
  updateBody()

  setInterval(() => {
    $('div.timeContainer span').textContent = formatTime(new Date())
  }, 1000)
})
