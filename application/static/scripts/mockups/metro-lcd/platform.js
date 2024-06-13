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
  let existing = $('.nextDeparture .departureInfo').className
  if (visible) {
    $('.nextDeparture .departureInfo').className = 'departureInfo ' + (existing.includes('vline') ? 'vline' : '')
  } else {
    $('.nextDeparture .departureInfo').className = 'departureInfo hidden ' + (existing.includes('vline') ? 'vline' : '')
  }
}

function setMessageText(text) {
  let lines = text.split('[NL]')
  let fullLength = lines.map(line => line.length).reduce((a, b) => a + b + 1, 0)
  let htmlJoined = lines.join('<br>')

  let textClass = 'larger'
  if (lines.length > 2 || fullLength > 20) textClass = 'large'
  if (lines.length > 2 || fullLength > 40) textClass = ''
  if (lines.length > 4 || fullLength > 90) textClass = 'small'
  if (lines.length > 4 || fullLength > 120) textClass = 'smaller'

  $('.message').innerHTML = `<p class="${textClass}">${htmlJoined}</p>`
  setMessagesActive(true)
}

function setStandClear() {
  $('.serviceMessage').innerHTML = '<p class="large">Stand Clear Train Departing</p>'
  setServiceMessageActive(true)
  setDepartureInfoVisible(false)
}

function setNoDepartures() {
  setMessageText('No trains departing from this platform')
}

function setBusesReplaceTrains() {
  setMessageText('NO TRAINS OPERATING[NL]REPLACEMENT BUSES[NL]HAVE BEEN ARRANGED')
}

function setNotTakingPassengers() {
  setMessageText('NOT TAKING SUBURBAN PASSENGERS')
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
  return stoppingPattern.map(e => `${e[0]}${e[1]}`).join(',')
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
    MAX_COLUMN_SIZE: 10
  })

  $('.stops').innerHTML = ''

  let check = []

  stopColumns.forEach((stopColumn, i) => {
    let outerColumn = document.createElement('div')
    let html = ''

    let hasStop = false

    stopColumn.forEach(stop => {
      let [stopName, express] = stop
      if (express)
        html += '<span>&nbsp;---</span><br>'
      else {
        if (stopName === 'Flemington Racecourse') stopName = 'Flemington Races'
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
      let containerWidth = parseFloat(computed.width) + 0.35 * parseFloat(computed.marginRight)
      let threshold = containerWidth * 0.95

      Array.from(container.children).forEach(station => {
        if (station.tagName === 'BR') return

        let childWidth = parseFloat(getComputedStyle(station).width)
        if (childWidth >= threshold * 1.04) {
          station.className = 'super-squish'
        } else if (childWidth >= threshold) {
          station.className = 'squish'
        }
      })
    })
  }, 1)
}

function updateBody() {
  $.ajax({
    method: 'POST',
    data: {
      csrf: $('[name=csrf]').value
    }
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    try {
      departures = body.dep

      let firstDeparture = departures[0]
      if (!firstDeparture) {
        if (body.bus.length) setBusesReplaceTrains()
        else setNoDepartures()
        return
      }

      showingStandClear = showingStandClear && firstDeparture.sch === previousDeparture

      if (!showingStandClear) {
        $('.burnLine').className = 'burnLine reset'
        setDepartureInfoVisible(true)

        let destination = firstDeparture.dest
        if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

        $('.firstDestination').textContent = destination
        $('.scheduledDiv span:nth-child(2)').textContent = formatTime(new Date(firstDeparture.sch))

        if (firstDeparture.type === 'vline') {
          $('.nextDeparture .departureInfo').className = 'departureInfo vline'
        } else {
          $('.nextDeparture .departureInfo').className = 'departureInfo'
        }

        if (firstDeparture.est) {
          let minutesToDeparture = rawMinutesToDeparture(new Date(firstDeparture.est))
          if (minutesToDeparture > 0) {
            $('.actualDiv div span:nth-child(1)').textContent = minutesToDeparture
            $('.actualDiv div span:nth-child(2)').textContent = 'min'
          } else {
            $('.actualDiv div span:nth-child(1)').textContent = 'NOW'
            $('.actualDiv div span:nth-child(2)').textContent = ''
          }
        } else {
          $('.actualDiv div span:nth-child(1)').textContent = '--'
          $('.actualDiv div span:nth-child(2)').textContent = 'min'
        }

        addStoppingPattern(firstDeparture.stops)
        setMessagesActive(false)

        if (destination === 'Arrival') setArrival()
      }

      let nextDepartures = [...departures.slice(1, 3), null, null].slice(0, 2)
      nextDepartures.forEach((departure, i) => {
        let div = $(`div.followingDeparture:nth-child(${i + 1})`)
        if (departure) {
          let destination = departure.dest

          if (destination === 'North Melbourne') destination = 'Nth Melbourne'
          if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
          if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

          $('.scheduled', div).textContent = formatTime(new Date(departure.sch))
          $('.destination', div).textContent = destination
          if (departure.est)
            $('.actual', div).textContent = `${rawMinutesToDeparture(new Date(departure.est))} min`
          else
            $('.actual', div).textContent = '-- min'

          $('.stoppingType', div).textContent = `${departure.type}${departure.via ? ` via ${departure.via}` : ''}`

          if (departure.v) {
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
      previousDeparture = firstDeparture.sch

      if (!showingStandClear) {
        let actualDepartureTimeRaw = firstDeparture.est || firstDeparture.sch
        let actualDepartureTime = new Date(actualDepartureTimeRaw)
        let difference = actualDepartureTime - new Date()

        showBurnLineTimeout = setTimeout(() => {
          if (burnLinesShown.includes(actualDepartureTimeRaw)) return
          burnLinesShown.push(actualDepartureTimeRaw)
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
