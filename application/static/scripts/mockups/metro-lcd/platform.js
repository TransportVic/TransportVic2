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
    $('.stops').style = 'display: none';
  } else {
    $('.message').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.stops').style = 'display: flex;'
  }
  $('.fullMessage').style = 'display: none;'
  $('.serviceMessage').style = 'display: none;'
  $('.content').className = 'content'
  $('.followingDepartures').style = 'display: block;'
}

function setFullMessageActive(active) {
  if (active) {
    $('.content').className = 'content announcements'
    $('.fullMessage').style = 'display: flex;'
    $('.nextDeparture').style = 'display: none;'
    $('.followingDepartures').style = 'display: none;'
    $('.stops').style = 'display: none;'
  } else {
    $('.content').className = 'content'
    $('.fullMessage').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.followingDepartures').style = 'display: block;'
    $('.stops').style = 'display: flex'
  }
  $('.message').style = 'display: none;'
  $('.serviceMessage').style = 'display: none;'
}

function setServiceMessageActive(active) {
  if (active) {
    $('.serviceMessage').style = 'display: flex;'
    $('.stops').style = 'display: none'
  } else {
    $('.serviceMessage').style = 'display: none;'
    $('.stops').style = 'display: flex'
  }
  $('.message').style = 'display: none;'
  $('.fullMessage').style = 'display: none;'
  $('.nextDeparture').style = 'display: flex;'
  $('.content').className = 'content'
  $('.followingDepartures').style = 'display: block;'
}

function setDepartureInfoVisible(visible) {
  if (visible) {
    $('.departureInfo').style = ''
  } else {
    $('.departureInfo').style = 'opacity: 0;'
  }
}

function setStandClear() {
  $('.serviceMessage').innerHTML = '<p class="large">Stand Clear Train Departing</p>'
  setServiceMessageActive(true)
  setDepartureInfoVisible(false)
}

function setNoDepartures() {
  $('.message').innerHTML = '<p class="large">No trains departing</p><p class="large"> from this platform</p>'
  setMessagesActive(true)
}

function setBusesReplaceTrains() {
  $('.message').innerHTML = '<p>NO TRAINS OPERATING</p><p>REPLACEMENT BUSES</p><p>HAVE BEEN ARRANGED</p>'
  setMessagesActive(true)
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen</p><p>for Announcements</p>'
  setFullMessageActive(true)
}

function setArrival() {
  $('.firstDestination').textContent = 'Arrival'
  $('.serviceMessage').innerHTML = '<div class="arrivalMessage"><img src="/static/images/mockups/no-boarding-train.svg" /><div><p>This train is not taking passengers.</p><p>Don\'t board this train.</p></div></div>'
  setServiceMessageActive(true)
}

let burnLinesShown = []
let showBurnLineTimeout = 0
let showingStandClear = false
let previousDeparture = null

function createStoppingPatternID(stoppingPattern) {
  return stoppingPattern.map(e => `${e.stopName}${e.isExpress}`).join(',')
}

let currentPattern = null

function addStoppingPattern(stops) {
  let newPatternID = createStoppingPatternID(stops)
  if (currentPattern === newPatternID) return true

  currentPattern = newPatternID
  let {stopColumns, size} = splitStops(stops.slice(1), false, {
    MAX_COLUMNS: 4,
    CONNECTION_LOSS: 2,
    MIN_COLUMN_SIZE: 5,
    MAX_COLUMN_SIZE: 9
  })

  $('.stops').innerHTML = ''

  let check = []

  stopColumns.forEach((stopColumn, i) => {
    let outerColumn = document.createElement('div')
    let html = ''

    let hasStop = false

    stopColumn.forEach(stop => {
      if (stop.isExpress)
        html += '<span>&nbsp;---</span><br>'
      else {
        let {stopName} = stop
        if (stopName === 'Upper Ferntree Gully') stopName = 'Upper F.T Gully'

        html += `<span>${stopName}</span><br>`

        hasStop = true
      }
    })

    outerColumn.innerHTML = `<div>${html}</div>`
    outerColumn.className = `stopsColumn columns-${size}${hasStop ? '' : ' expressColumn'}`

    $('.stops').appendChild(outerColumn)

    if (hasStop) {
      check.push($('div', outerColumn))
    }
  })

  setTimeout(() => {
    check.forEach(container => {
      let computed = getComputedStyle(container.parentElement)
      let containerWidth = parseFloat(computed.width) + 0.3 * parseFloat(computed.marginRight)
      let threshold = containerWidth * 0.9

      Array.from(container.children).forEach(station => {
        if (station.tagName === 'BR') return

        let childWidth = parseFloat(getComputedStyle(station).width)
        if (childWidth >= threshold) {
          station.className = 'squish'
        }
      })
    })
  }, 1)
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    try {
      departures = body.departures

      let firstDeparture = departures[0]
      if (!firstDeparture) {
        if (body.hasRRB) setBusesReplaceTrains()
        else setNoDepartures()
        return
      }

      showingStandClear = showingStandClear && firstDeparture.scheduledDepartureTime === previousDeparture

      if (!showingStandClear) {
        $('.burnLine').className = 'burnLine reset'
        setDepartureInfoVisible(true)

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
        } else {
          $('.actualDiv div span:nth-child(1)').textContent = '--'
          $('.actualDiv div span:nth-child(2)').textContent = 'min'
        }

        addStoppingPattern(firstDeparture.additionalInfo.screenStops)
        setMessagesActive(false)

        if (firstDeparture.additionalInfo.notTakingPassengers) setArrival()
      }

      let nextDepartures = [...departures.slice(1, 3), null, null].slice(0, 2)
      nextDepartures.forEach((departure, i) => {
        let div = $(`div.followingDeparture:nth-child(${i + 1})`)
        if (departure) {
          let {destination} = departure

          if (destination === 'North Melbourne') destination = 'Nth Melbourne'
          if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
          if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

          $('.scheduled', div).textContent = formatTime(new Date(departure.scheduledDepartureTime))
          $('.destination', div).textContent = destination
          if (departure.estimatedDepartureTime)
            $('.actual', div).textContent = departure.minutesToDeparture
          else
            $('.actual', div).textContent = '--'
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

          div.className = 'followingDeparture'
        }
      })

      clearTimeout(showBurnLineTimeout)
      previousDeparture = firstDeparture.scheduledDepartureTime

      if (!showingStandClear) {
        let actualDepartureTime = new Date(firstDeparture.actualDepartureTime)
        let difference = actualDepartureTime - new Date()

        showBurnLineTimeout = setTimeout(() => {
          if (burnLinesShown.includes(firstDeparture.actualDepartureTime)) return
          burnLinesShown.push(firstDeparture.actualDepartureTime)
          burnLinesShown = burnLinesShown.slice(-10)

          $('.burnLine').className = 'burnLine active'

          $('.actualDiv div span:nth-child(1)').textContent = 'NOW'
          $('.actualDiv div span:nth-child(2)').textContent = ''

          showingStandClear = true

          setTimeout(() => {
            setStandClear()
          }, 1000 * 15)
        }, difference - 1000 * 15)
      }
    } catch (e) {
      setListenAnnouncements()
    }
  })
}

$.ready(() => {
  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})
