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

function shortenStoppingType (type) {
  if (type === 'Stops All Stations') return 'Stops All'
  if (type === 'Limited Express') return 'Ltd Express'
  return type
}

let stopScrolling = false

let firstRowTimeout, firstRowPause
let secondRowTimeout, secondRowPause

let firstScheduledTime, firstStoppingPattern

let departures

function setServiceMessageActive(state) {
  if (state) {
    $('.serviceMessage').style = 'display: block;'
    $('div.middleRow .stoppingType').style = 'display: none;'
    $('div.middleRow .stoppingPattern').style = 'display: none;'
    $('.firstDestination').style = 'display: none;'
    $('.firstDepartureInfo').style = 'display: none;'
  } else {
    $('.serviceMessage').style = 'display: none;'
    $('div.middleRow .stoppingType').style = 'opacity: 1;'
    $('div.middleRow .stoppingPattern').style = 'opacity: 0;'
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

  $('div.middleRow .stoppingType').style = 'opacity: 1;'
  $('div.middleRow .stoppingPattern').style = 'opacity: 0;'
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
  $('div.middleRow .stoppingType').style = 'opacity: 1;'
  $('div.middleRow .stoppingPattern').style = 'opacity: 0;'
  $('.firstDestination').style = ''
  $('.firstDepartureInfo').style = ''
}

function setNoDepartures() {
  $('.message').innerHTML = '<p>No trains departing from</p><p>this platform</p>'
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
      setServiceMessageActive(false)

      showingStandClear = false

      let classes = ''

      $('.firstDestination').textContent = firstDeparture.destination
      $('.firstDestination').className = 'firstDestination'
      let width = parseInt(getComputedStyle($('.firstDestination')).width)
      let vw = window.innerWidth / 100
      if (width > 70*vw) {
        $('.firstDestination').className += ' smallest'
      } else if (width > 50*vw) {
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

      $('.middleRow p.stoppingType').textContent = firstStoppingType
      $('.middleRow p.stoppingPattern').textContent = firstDeparture.stoppingPattern
      $('.middleRow p.stoppingPattern').setAttribute('data-text', firstDeparture.stoppingPattern)

    }

    let secondDeparture = departures[1]
    let secondClassName = ''

    if (secondDeparture) {
      if (secondDeparture.type === 'vline') secondClassName = ' vline'

      $('div.bottomRow').className = `bottomRow${secondClassName}`
      $('div.bottomRow > span:nth-child(1)').textContent = formatTime(new Date(secondDeparture.scheduledDepartureTime))
      $('div.bottomRow > span:nth-child(2)').textContent = secondDeparture.destination
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
      if (!firstTime)
        stopScrolling = true
      clearTimeout(firstRowTimeout)
      clearTimeout(firstRowPause)
      clearTimeout(secondRowTimeout)
      clearTimeout(secondRowPause)

      drawBottomRow()
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
          setServiceMessageActive(true)
        }, 1000 * 15)
      }, difference - 1000 * 20)
    }
  })
}


function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
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

  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling) {
      stopScrolling = false
      return
    }

    xPosition -= shiftWidth
    firstStoppingPatternP.style.marginLeft = xPosition + 'px'
    await asyncPause(10)
  }
  await asyncPause(200)
}

function drawBottomRow(shouldPause=false) {
  if (showingStandClear) return
  if (firstStoppingPatternP.textContent.includes('Not Stopping At')) {
    firstStoppingTypeP.style = 'opacity: 0;'
    firstStoppingPatternP.style = 'opacity: 1;'
    firstStoppingTypeP.textContent = ''
    firstStoppingPatternP.textContent = firstStoppingPatternP.getAttribute('data-text')
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
  setInterval(updateBody, 1000 * 30)
  updateBody(true)

  setInterval(() => {
    $('div.timeNow span').textContent = formatTime(new Date())
  }, 1000)

  firstStoppingTypeP = $('div.middleRow p.stoppingType')
  firstStoppingPatternP = $('div.middleRow p.stoppingPattern')
})
