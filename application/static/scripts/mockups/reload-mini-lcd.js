
function getStoppingPattern(additionalInfo) {
  let { screenStops } = additionalInfo

  let stoppingPattern = ''
  let blocks = []
  let currentBlock = []
  let blockIsExpress = 'stops'
  screenStops.forEach(stop => {
    if (!(blockIsExpress || stop.isExpress) ||
        blockIsExpress && stop.isExpress)
      currentBlock.push(stop.stopName)
    else {
      blocks.push({stops: currentBlock, isExpress: blockIsExpress})
      currentBlock = [stop.stopName]
      blockIsExpress = stop.isExpress
    }
  })
  blocks.push({stops: currentBlock, isExpress: blockIsExpress})
  blocks = blocks.filter(block => block.stops.length)

  if (additionalInfo.expressCount == 1)
    return 'Not Stopping At ' + blocks[1].stops[0]
  if (additionalInfo.expressCount == 0)
    return 'Stops All Stations'

  blocks = blocks.filter(block => block.stops.length)
  let previousExpress = false;

  blocks.forEach((block, i) => {
    if (i > 0 && i < blocks.length - 1 && !block.isExpress && blocks[i - 1].isExpress && blocks[i + 1].isExpress) {
      previousExpress = true
      return
    } else if (i > 0 && i < blocks.length - 1 && block.isExpress && !blocks[i - 1].isExpress && !blocks[i + 1].isExpress) {
     stoppingPattern += ', '
     if (!previousExpress)
       stoppingPattern += 'then runs express from '
     stoppingPattern += blocks[i - 1].stops.slice(-1)[0] + ' to ' + blocks[i + 1].stops[0]
     return
    }

    previousExpress = false

    if (i > 0)
      stoppingPattern += ', then '

    if (block.isExpress)
      stoppingPattern += 'runs express'
    else if (block.stops.length > 1)
      stoppingPattern += 'stops all stations'

    if (i == 0) {
      stoppingPattern += ' to ' + block.stops.slice(-1)[0]
    } else if (i < blocks.length - 1) {
      stoppingPattern += ', ' + blocks[i - 2].stops.slice(-1)[0] + ' to ' + block.stops.slice(-1)[0]
    } else {
      stoppingPattern += ' to ' + block.stops.slice(-1)[0]
    }

    //stops all stations to x, then runs express to Y, then stops all stations to Z
  })

  return stoppingPattern.slice(0, 1).toUpperCase() + stoppingPattern.slice(1)
}

let stoppingPatternWidth = 0;

function getStoppingType(additionalInfo) {
  if (additionalInfo.expressCount === 0)
    return 'Stops All'
  else if (additionalInfo.expressCount <= 2)
    return 'Ltd Express'
  else return 'Express'
}

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

let departures

setInterval(() => {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    departures = body.departures

    let firstDeparture = departures[0]
    if (firstDeparture.trip.destination === 'Parliament') firstDeparture.trip.destination = 'City Loop'
    let style = ''

    if (firstDeparture.trip.destination.length > 12)
      style = 'transform: translateX(-5%) scaleX(0.9)'
    $('.firstDestination').textContent = firstDeparture.trip.destination
    $('.firstDestination').style = style
    $('div.scheduled p:nth-child(2)').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

    if (firstDeparture.minutesToDeparture > 0) {
      $('div.actual div span:nth-child(1)').textContent = firstDeparture.minutesToDeparture
      $('div.actual div span:nth-child(2)').textContent = 'min'
    } else {
      $('div.actual div span:nth-child(1)').textContent = 'Now'
      $('div.actual div span:nth-child(2)').textContent = ''
    }

    let newStoppingPattern = getStoppingPattern(firstDeparture.additionalInfo)
    if (newStoppingPattern !== $('div.middleRow p').textContent) {
      $('div.middleRow p').style = ''
      $('div.middleRow p').textContent = newStoppingPattern
      stoppingPatternWidth = parseInt(getComputedStyle($('div.middleRow p')).width.slice(0, -2))
    }

    let secondDeparture = departures[1]
    if (secondDeparture) {
      if (secondDeparture.trip.destination === 'Parliament') secondDeparture.trip.destination = 'City Loop'
      $('div.bottomRow > span:nth-child(1)').textContent = formatTime(new Date(secondDeparture.scheduledDepartureTime))
      $('div.bottomRow > span:nth-child(2)').textContent = secondDeparture.trip.destination
      $('div.bottomRow > span:nth-child(3)').textContent = getStoppingType(secondDeparture.additionalInfo)
      $('div.bottomRow > div > span:nth-child(1)').textContent = secondDeparture.minutesToDeparture
      $('div.bottomRow > div > span:nth-child(2)').textContent = 'min'
    } else {
      $('div.bottomRow > span:nth-child(1)').textContent = '--'
      $('div.bottomRow > span:nth-child(2)').textContent = '--'
      $('div.bottomRow > span:nth-child(3)').textContent = '--'
      $('div.bottomRow > div > span:nth-child(1)').textContent = '--'
      $('div.bottomRow > div > span:nth-child(2)').textContent = ''
    }
  })
}, 1000 * 15)

setInterval(() => {
  $('div.timeNow span').textContent = formatTime(new Date())
}, 1000)

let desiredFPS = 18
let scrollRate = 180 // px/sec
let initialOffset = window.innerWidth / 200
let stoppingPatternOffset = initialOffset;
let stoppingPatternP = $('div.middleRow p')

function scrollText() {
  let toScroll = scrollRate / desiredFPS
  stoppingPatternOffset -= toScroll
  stoppingPatternP.style = `margin-left: ${stoppingPatternOffset}px;`
  return stoppingPatternOffset
}

function animateScrollingText(callback) {
  if (departures)
    stoppingPatternP.textContent = getStoppingPattern(departures[0].additionalInfo)
  setTimeout(() => {
    let i = setInterval(() => {
      if (scrollText() < -stoppingPatternWidth - 1.5 * scrollRate || stoppingPatternWidth < window.innerWidth) {
        clearInterval(i)
        stoppingPatternP.style = `margin-left: ${initialOffset}px;`
        stoppingPatternOffset = initialOffset
        callback()
      }
    }, 1 / desiredFPS)
  }, 5000)
}

function alternateTexts() {
  animateScrollingText(() => {
    if (departures)
      stoppingPatternP.textContent = getStoppingType(departures[0].additionalInfo)
    setTimeout(() => {
      alternateTexts()
    }, 5000)
  })
}

$.ready(() => {
  setTimeout(() => {
    stoppingPatternWidth = parseInt(getComputedStyle(stoppingPatternP).width.slice(0, -2))
    alternateTexts()
  }, 100)
})
