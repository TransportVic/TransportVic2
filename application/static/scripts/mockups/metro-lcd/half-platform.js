function setMessagesActive(active) {
  if (active) {
    $('.message').style = 'display: flex;'
    $('.nextDeparture').style = 'display: none;'
    $('.stops').style = 'display: none';
  } else {
    $('.message').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.stops').style = 'display: flex';
  }
  $('.fullMessage').style = 'display: none;'
  $('.serviceMessage').style = 'display: none;'
  $('.left').style = 'display: block;'
  $('.right').style = 'display: flex;'
  $('.content').className = 'content'
}

function setFullMessageActive(active) {
  if (active) {
    $('.content').className = 'content announcements'
    $('.fullMessage').style = 'display: flex;'
    $('.stops').style = 'display: none';
    $('.vertLine').style = 'display: none';
    $('.left').style = 'display: none;'
    $('.right').style = 'display: none;'
  } else {
    $('.content').className = 'content'
    $('.fullMessage').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.stops').style = 'display: flex';
    $('.vertLine').style = 'display: block';
    $('.left').style = 'display: block;'
    $('.right').style = 'display: flex;'
  }
  $('.message').style = 'display: none;'
  $('.serviceMessage').style = 'display: none;'
}

function setServiceMessageActive(active) {
  if (active) {
    $('.serviceMessage').style = 'display: flex;'
    $('.stops').style = 'display: none';
    $('.left').style = 'display: block;'
    $('.right').style = 'display: flex;'
  } else {
    $('.serviceMessage').style = 'display: none;'
    $('.stops').style = 'display: flex';
    $('.left').style = 'display: block;'
    $('.right').style = 'display: flex;'
  }
  $('.message').style = 'display: none;'
  $('.fullMessage').style = 'display: none;'
  $('.nextDeparture').style = 'display: flex;'
  $('.content').className = 'content'
}

function setDepartureInfoVisible(visible) {
  let existing = $('.nextDeparture .departureInfo').className
  if (visible) {
    $('.nextDeparture .departureInfo').className = 'departureInfo ' + (existing.includes('vline') ? 'vline' : '')
  } else {
    $('.nextDeparture .departureInfo').className = 'departureInfo hidden ' + (existing.includes('vline') ? 'vline' : '')
  }
}

function setStandClear() {
  $('.serviceMessage').innerHTML = '<p class="large">Stand Clear Train</p><p class="large">Departing</p>'
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

function setNotTakingPassengers() {
  $('.message').innerHTML = '<p class="large">NOT TAKING</p><p class="large">SUBURBAN</p><p class="large">PASSENGERS</p>'
  setMessagesActive(true)
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
  setFullMessageActive(true)
}

function setArrival() {
  $('.firstDestination').textContent = 'Arrival'
  $('.serviceMessage').innerHTML = '<div class="arrivalMessage"><p>This train is not taking</p><p>passengers.</p><p>Don\'t board this train.</p></div>'
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
      departures = body.dep

      let firstDeparture = departures[0]
      if (!firstDeparture) {
        if (body.bus.length) setBusesReplaceTrains()
        else setNoDepartures()
        return
      }

      showingStandClear = showingStandClear && firstDeparture.sch === previousDeparture

      if (!showingStandClear) {
        if (!firstDeparture.p && firstDeparture.v) {
          setNotTakingPassengers()
        } else {
          $('.burnLine').className = 'burnLine reset'
          setDepartureInfoVisible(true)

          $('.firstDestination').textContent = firstDeparture.dest
          $('.scheduledDiv span:nth-child(2)').textContent = formatTimeB(new Date(firstDeparture.sch))

          if (firstDeparture.v) {
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

          if (!firstDeparture.dest === 'Arrival') setArrival()
        }
      }

      let nextDepartures = [...departures.slice(1, 4), null, null, null].slice(0, 3)
      nextDepartures.forEach((departure, i) => {
        let div = $(`div.followingDeparture:nth-child(${i + 2})`)
        if (departure) {
          let destination = departure.dest

          if (destination === 'North Melbourne') destination = 'Nth Melbourne'
          if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
          if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

          $('.scheduled', div).textContent = formatTimeB(new Date(departure.sch))
          $('.destination', div).textContent = destination
          if (departure.est)
            $('.actual', div).textContent = rawMinutesToDeparture(new Date(departure.est))
          else
            $('.actual', div).textContent = '--'
          $('.stoppingType', div).textContent = departure.type

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
      console.log(e)
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

function setTime() {
  $('.clock span').textContent = formatTimeB(new Date())
}

function setupClock() {
  setTime()
  let msToNextSecond = 1000 - (+new Date() % 1000)
  setTimeout(() => {
    setTime()
    setInterval(setTime, 1000)
  }, msToNextSecond)
}

$.ready(() => {
  setupClock()
})
