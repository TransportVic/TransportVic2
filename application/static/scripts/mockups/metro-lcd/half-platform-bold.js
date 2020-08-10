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

let stopScrolling = false
let isScrolling = false

let firstRowPause

let firstScheduledTime, firstStoppingPattern

let departures
let isArrival = false

function showStoppingType() {
  if (firstStoppingPatternP.textContent.includes('Not Stopping At')) {
    firstStoppingTypeP.style = 'opacity: 0;'
    firstStoppingPatternP.style = 'opacity: 1;'
    firstStoppingTypeP.textContent = ''
  } else {
    firstStoppingTypeP.style = 'opacity: 1;'
    firstStoppingPatternP.style = 'opacity: 0;'
  }
}

function setServiceMessageActive(state, doNotUpdate=false) {
  if (state) {
    $('.serviceMessage').style = 'display: block;'
    $('div.middleRow .stoppingType').style = 'display: none;'
    $('div.middleRow .stoppingPattern').style = 'display: none;'
    $('.firstDestination').style = 'display: none;'
    $('.firstDepartureInfo').style = 'display: none;'
  } else {
    $('.serviceMessage').style = 'display: none;'
    if (!doNotUpdate)
      showStoppingType()
    $('.firstDestination').style = ''
    $('.firstDepartureInfo').style = ''
  }
  $('.message').style = 'display: none;'
  $('.fullMessage').style = 'display: none;'
  $('.nextDepartures').style = 'display: block;'
  $('.firstDeparture').style = 'display: block;'
  $('.content').className = 'content'
}

function setMessagesActive(state) {
  if (state) {
    $('.message').style = 'display: flex;'
    $('.firstDeparture').style = 'display: none;'
  } else {
    $('.message').style = 'display: none;'
    $('.firstDeparture').style = 'display: block;'
  }
  $('.fullMessage').style = 'display: none;'
  $('.nextDepartures').style = 'display: block;'
  $('.serviceMessage').style = 'display: none;'

  showStoppingType()
  $('.firstDestination').style = ''
  $('.firstDepartureInfo').style = ''
  $('.content').className = 'content'
}

function setFullMessageActive(state) {
  if (state) {
    $('.content').className = 'content announcements'
    $('.message').style = 'display: none;'
    $('.fullMessage').style = 'display: flex;'
    $('.nextDepartures').style = 'display: none;'
    $('.firstDeparture').style = 'display: none;'
  } else {
    $('.content').className = 'content'
    $('.message').style = 'display: none;'
    $('.fullMessage').style = 'display: none;'
    $('.nextDepartures').style = 'display: block;'
    $('.firstDeparture').style = 'display: block;'
  }
  $('.serviceMessage').style = 'display: none;'
  showStoppingType()
  $('.firstDestination').style = ''
  $('.firstDepartureInfo').style = ''
}

function setNoDepartures() {
  $('.fullMessage').innerHTML = '<div class="fixedMessage"><p>No trains departing from</p><p>this platform</p></div>'
  setFullMessageActive(true)
}

function setBusesReplaceTrains() {
  $('.message').innerHTML = '<p>NO TRAINS OPERATING</p><p>REPLACEMENT BUSES</p><p>HAVE BEEN ARRANGED</p>'
  setMessagesActive(true)
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<div class="announcements"><img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p></div>'
  setFullMessageActive(true)
}

function setStandClear() {
  $('.serviceMessage').textContent = 'Stand Clear Train Departing'
  setServiceMessageActive(true)
}

function setArrival() {
  isArrival = true

  $('.serviceMessage').style = 'display: block;'
  $('div.middleRow .stoppingType').style = 'display: none;'
  $('div.middleRow .stoppingPattern').style = 'display: none;'

  $('.firstDestination').textContent = 'Arrival'
  $('.firstDestination').className = 'firstDestination'

  $('.serviceMessage').innerHTML = '<div class="arrivalMessage"><img src="/static/images/mockups/no-boarding-train.svg" /><p>Not taking passengers,please don\'t board</p></div>'
}

let burnLinesShown = []
let showBurnLineTimeout = 0
let showingBurnLine = false
let showingStandClear = false
let previousDeparture = null

function updateBody(firstTime) {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    try {
      departures = body.departures.map(d => {
        if (d.stoppingType === 'Stops All') d.stoppingType = 'Stops All Stations'
        return d
      })

      let firstDeparture = departures[0]
      let message = $('.message')
      let main = $('.nextDepartures')

      if (!firstDeparture) {
        if (body.hasRRB) setBusesReplaceTrains()
        else setNoDepartures()
        return
      }

      showingBurnLine = showingBurnLine && firstDeparture.scheduledDepartureTime === previousDeparture

      if (!showingBurnLine) {
        $('.burnLine').className = 'burnLine reset'

        showingStandClear = false
        setServiceMessageActive(false, true)

        if (firstDeparture.additionalInfo.notTakingPassengers) setArrival()
        else {
          isArrival = false

          let classes = ''

          $('.firstDestination').textContent = firstDeparture.destination
          $('.firstDestination').className = 'firstDestination'
          let width = parseInt(getComputedStyle($('.firstDestination')).width)
          let vw = window.innerWidth / 100

          if (width > 76*vw) {
            $('.firstDestination').className += ' smallest'
          } else if (width > 65*vw) {
            $('.firstDestination').className += ' smaller'
          }

          $('div.scheduled p:nth-child(2)').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

          if (firstDeparture.estimatedDepartureTime) {
            if (firstDeparture.minutesToDeparture > 0) {
              $('div.actual div span:nth-child(1)').textContent = firstDeparture.minutesToDeparture
              $('div.actual div span:nth-child(2)').textContent = 'min'
            } else {
              $('div.actual div span:nth-child(1)').textContent = 'Now'
              $('div.actual div span:nth-child(2)').textContent = ''
            }
          } else {
            $('div.actual div span:nth-child(1)').textContent = '--'
            $('div.actual div span:nth-child(2)').textContent = 'min'
          }

          let firstStoppingType = firstDeparture.stoppingType
          if (firstDeparture.additionalInfo.via) {
            firstStoppingType += ' ' + firstDeparture.additionalInfo.via
          }

          firstStoppingTypeP.textContent = firstStoppingType
          firstStoppingPatternP.textContent = firstDeparture.stoppingPattern
          firstStoppingPatternP.setAttribute('data-text', firstDeparture.stoppingPattern)
        }
      }

      let secondDeparture = departures[1]
      let secondClassName = ''

      if (secondDeparture) {
        if (secondDeparture.type === 'vline') secondClassName = ' vline'

        $('div.bottomRow').className = `bottomRow${secondClassName}`
        $('div.bottomRow > span:nth-child(1)').textContent = formatTime(new Date(secondDeparture.scheduledDepartureTime))

        let {destination} = secondDeparture

        if (destination === 'North Melbourne') destination = 'Nth Melbourne'
        if (destination === 'Upper Ferntree Gully') destination = 'Upper F.T Gully'
        if (destination === 'Flemington Racecourse') destination = 'Flemington Races'

        $('div.bottomRow > span:nth-child(2)').textContent = destination

        let secondStoppingType = shortenStoppingType(secondDeparture.stoppingType)
        if (secondDeparture.additionalInfo.via) {
          secondStoppingType += ' ' + secondDeparture.additionalInfo.via
        }
        $('div.bottomRow > span:nth-child(3)').textContent = secondStoppingType

        if (secondDeparture.estimatedDepartureTime)
          $('div.bottomRow > div > span:nth-child(1)').textContent = secondDeparture.minutesToDeparture
        else $('div.bottomRow > div > span:nth-child(1)').textContent = '--'
      } else {
        $('div.bottomRow').className = `bottomRow`
        $('div.bottomRow > span:nth-child(1)').textContent = '--'
        $('div.bottomRow > span:nth-child(2)').textContent = '--'
        $('div.bottomRow > span:nth-child(3)').textContent = ''
        $('div.bottomRow > div > span:nth-child(1)').textContent = '--'
      }

      if (firstDeparture.scheduledDepartureTime !== previousDeparture) {
        if (isArrival) {
          stopScrolling = true
        } else {
          setServiceMessageActive(false)
          if (!firstTime && isScrolling)
            stopScrolling = true

          clearTimeout(firstRowPause)
          drawBottomRow()
        }
      }

      clearTimeout(showBurnLineTimeout)
      previousDeparture = firstDeparture.scheduledDepartureTime

      if (!showingBurnLine) {
        let actualDepartureTime = new Date(firstDeparture.actualDepartureTime)
        let difference = actualDepartureTime - new Date()

        showBurnLineTimeout = setTimeout(() => {
          if (burnLinesShown.includes(firstDeparture.actualDepartureTime)) return
          burnLinesShown.push(firstDeparture.actualDepartureTime)
          burnLinesShown = burnLinesShown.slice(-10)

          showingBurnLine = true

          $('.burnLine').className = 'burnLine active'
          $('div.actual div span:nth-child(1)').textContent = 'Now'
          $('div.actual div span:nth-child(2)').textContent = ''

          setTimeout(() => {
            showingStandClear = true
            stopScrolling = true
            setStandClear()
          }, 1000 * 15)
        }, difference - 1000 * 20)
      }
    } catch (e) {
      setListenAnnouncements()
    }
  })
}


function asyncPause(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}

let shiftWidth = window.innerWidth / 200 // px
let firstStoppingTypeP
let firstStoppingPatternP

let stoppingPatternWidth = 0

async function animateScrollingText() {
  if (stoppingPatternWidth < window.innerWidth) {
    return await asyncPause(4000) || true
  }

  let iterationCount = Math.ceil((stoppingPatternWidth) / shiftWidth)
  let xPosition = shiftWidth

  await asyncPause(2000)

  isScrolling = true
  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling) {
      stopScrolling = false
      return
    }

    xPosition -= shiftWidth
    firstStoppingPatternP.style.marginLeft = xPosition + 'px'
    await asyncPause(10)
  }
  isScrolling = false
  await asyncPause(200)
}

function drawBottomRow(shouldPause=false) {
  if (showingStandClear || isArrival) return

  if (firstStoppingPatternP.textContent.includes('Not Stopping At')) {
    firstStoppingTypeP.style = 'opacity: 0;'
    firstStoppingPatternP.style = 'opacity: 1;'
    firstStoppingTypeP.textContent = ''

    return
  }

  firstStoppingTypeP.style = 'opacity: 1;'
  firstStoppingPatternP.style = 'opacity: 0;'
  if (shouldPause)
    setTimeout(() => {
      firstStoppingPatternP.textContent = ''
    }, 260)
  else
    firstStoppingPatternP.textContent = ''

  if (stopScrolling) return

  firstRowPause = setTimeout(async () => {
    if (showingStandClear) return
    if (firstStoppingTypeP.textContent.includes('Stops All Stations')) return await asyncPause(4000)

    firstStoppingPatternP.textContent = firstStoppingPatternP.getAttribute('data-text')
    firstStoppingTypeP.style = 'opacity: 0;'
    firstStoppingPatternP.style = 'opacity: 1;'

    stoppingPatternWidth = parseInt(getComputedStyle(firstStoppingPatternP).width) + window.innerWidth * 0.05

    drawBottomRow(await animateScrollingText())
  }, 4000)
}

$.ready(() => {
  updateBody(true)
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))

  firstStoppingTypeP = $('div.middleRow p.stoppingType')
  firstStoppingPatternP = $('div.middleRow p.stoppingPattern')
})

function setTime() {
  $('.clock span').textContent = formatTime(new Date())
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
