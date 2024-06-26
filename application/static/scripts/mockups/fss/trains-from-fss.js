function setTime() {
  $('.clock span').textContent = formatTime(new Date(), { includeSeconds: 1, showAMPM: 1, spaceBeforeAMPM: 1 })
}

function setupClock() {
  setTime()
  let msToNextSecond = 1000 - (+new Date() % 1000)
  setTimeout(() => {
    setTime()
    setInterval(setTime, 1000)
  }, msToNextSecond)
}

let currentlyDisplaying = 'next-out'

function setFullMessageActive(active) {
  if (active) {
    $('.content').style = 'display: none;'
    $('.fullMessage').style = 'display: flex;'
  } else {
    currentlyDisplaying = 'next-out'
    $('.content').style = 'display: flex;'
    $('.fullMessage').style = 'display: none;'
  }
}

function setListenAnnouncements() {
  if (currentlyDisplaying !== 'announcements') {
    currentlyDisplaying = 'announcements'
    $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
    setFullMessageActive(true)
  }
}

function setArrowActive(section, active) {
  let arrowMarker = $(`#A-${section}`)
  if (arrowMarker)
    arrowMarker.style = `display: ${active ? '' : 'none'};`
}

function setSectionColour(section, colour) {
  $(`#${section}`).setAttribute('stroke', colour)
}

let destinationSections = [
  {
    target: 'Southern Cross',
    id: 'SSS'
  },
  {
    target: 'Parliament',
    id: 'CCL'
  },
  {
    target: 'North Melbourne',
    id: 'NME'
  },
  {
    target: 'Richmond',
    id: 'RMD'
  },
]

let diagramSections = [
  {
    targets: ['North Melbourne'],
    not: ['Flagstaff', 'Parliament'],
    key: 'FSS-SSS-NME'
  },
  {
    targets: ['Richmond'],
    not: ['Parliament'],
    key: 'FSS-RMD'
  },
  {
    targets: ['Flagstaff', 'Parliament'],
    not: ['North Melbourne'],
    key: 'FSS-CCL-PAR'
  },
  {
    targets: ['Parliament', 'North Melbourne'],
    key: 'FSS-CCL-NME'
  },
  {
    targets: ['Parliament', 'Richmond'],
    key: 'PAR-RMD'
  }
]

let lineColours = {
  'Alamein': '152C6B',
  'Belgrave': '152C6B',
  'Craigieburn': 'FFBE00',
  'Cranbourne': '279FD5',
  'Frankston': '028430',
  'Glen Waverley': '152C6B',
  'Hurstbridge': 'BC2431',
  'Lilydale': '152C6B',
  'Mernda': 'BC2431',
  'Pakenham': '279FD5',
  'Sandringham': 'F178AF',
  'Stony Point': '028430',
  'Sunbury': 'FFBE00',
  'Upfield': 'FFBE00',
  'Werribee': '028430',
  'Williamstown': '028430',
  'City Circle': '000000',
  'Showgrounds/Flemington': 'CE0058'
}

function identifyTargetStop(departure, target) {
  let targetStop = departure.times.find(stop => stop.name === target)

  let actualDepartureTime = new Date(departure.est || departure.sch)
  let scheduledDepartureTime = new Date(departure.sch)

  let fssStop = departure.times.find(stop => stop.name === 'Flinders Street')
  let fssMinutes = fssStop.time
  let targetMinutes = targetStop.time

  let minutesDifference = targetMinutes - fssMinutes

  let targetActualTime = new Date(+actualDepartureTime + minutesDifference * 1000 * 60)

  departure.act = actualDepartureTime
  departure.targetActualTime = targetActualTime

  return departure
}

function setDestinationsRow(departures) {
  destinationSections.forEach(section => {
    let {target, id} = section

    let validDepartures = departures.filter(departure => {
      return !departure.v && departure.times.some(stop => stop.name === target)
    }).map(departure => {
      return identifyTargetStop(departure, target)
    }).sort((a, b) => a.targetActualTime - b.targetActualTime)

    let next2 = validDepartures.slice(0, 2)

    let departureDivs = Array.from(document.querySelectorAll(`#to${id} div.next2 div.departure`))

    next2.forEach((departure, i) => {
      let departureDiv = departureDivs[i]
      $('.platform', departureDiv).textContent = departure.plt
      $('.platform', departureDiv).className = 'platform ' + encode(departure.route)
      $('.minutesToDeparture', departureDiv).textContent = minutesToDeparture(departure.act, true)
    })

    let numberMissing = 2 - next2.length

    for (let i = 0; i < numberMissing; i++) {
      let departureDiv = departureDivs[next2.length + i]
      $('.platform', departureDiv).textContent = '--'
      $('.platform', departureDiv).className = 'platform no-line'
      $('.minutesToDeparture', departureDiv).textContent = '-- min'
    }
  })
}

function updateDiagram(departures) {
  diagramSections.forEach(section => {
    let {targets, not, key} = section
    let lastTarget = targets.slice(-1)[0]

    let nextDeparture = departures.filter(departure => {
      if (departure.v) return false
      for (let target of targets) {
        if (!departure.times.find(stop => stop.name === target))
          return false
      }
      if (not) {
        for (let excluded of not)
          if (departure.times.find(stop => stop.name === excluded))
            return false
      }
      return true
    }).map(departure => {
      return identifyTargetStop(departure, lastTarget)
    }).sort((a, b) => a.targetActualTime - b.targetActualTime)[0]

    if (nextDeparture) {
      setArrowActive(key, true)
      setSectionColour(key, '#' + lineColours[nextDeparture.route])
    } else {
      setArrowActive(key, false)
      setSectionColour(key, '#C0C0C0')
    }
  })
}

function updateBody() {
  $.ajax({
    method: 'POST',
    data: {
      csrf: $('[name=csrf]').value
    }
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()
    setFullMessageActive(false)

    try {
      let departures = body.dep
      setDestinationsRow(departures)
      updateDiagram(departures)

      setSVGSize()
      $('#cclSVG').setAttribute('display', '')
    } catch (e) {
      console.error(e)
      setListenAnnouncements()
    }
  })
}

function setSVGSize() {
  let windowSize = parseInt(getComputedStyle(document.body).getPropertyValue('width').slice(0, -2))
  let targetSize = windowSize * 0.48

  let scalingFactor = targetSize / 61.45

  let containerHeight = targetSize * (38.34/61.45)

  $('#cclSVG').style = `transform: scale(${scalingFactor})`
  $('#svgContainer').style = `height: ${containerHeight}px`
}

$.loaded(() => {
  setTimeout(() => {
    setSVGSize()
    $('#cclSVG').setAttribute('display', '')
  }, 100)
})

$.ready(() => {
  setupClock()
  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})

window.on('resize', setSVGSize) // really just a utility function...
