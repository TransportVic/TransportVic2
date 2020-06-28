let bays = []

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  if (hours < 10) mainTime += '0'
  mainTime += hours

  mainTime += ':'

  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  return mainTime
}

let currentlyDisplaying = ''

function setListenAnnouncements() {
  if (currentlyDisplaying !== 'announcements') {
    currentlyDisplaying = 'announcements'
    $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
    setFullMessagesActive(true)
  }
}

function setFullMessagesActive(active) {
  if (active) {
    $('.fullMessage').style = 'display: flex;'
    $('.content').style = 'display: none;'
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.content').style = 'display: flex;'
    currentlyDisplaying = ''
  }
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()
    setFullMessagesActive(false)

    let departures = {}

    bays.forEach(bay => departures['Bay ' + bay] = null)

    body.forEach(departure => {
      if (departures[departure.bay] === null) {
        departures[departure.bay] = departure
      }
    })

    bays.forEach(bay => {
      let departure = departures['Bay ' + bay]
      let departureDiv = $(`[data-bay="Bay ${bay}"]`)

      if (departure) {
        $('p.title', departureDiv).textContent = `Bay ${bay} - ${departure.departureTime} ${departure.destination}`
        $('p.stopsAt', departureDiv).textContent = 'Stops At: ' + departure.stopsAt.join(', ')
        $('p.information', departureDiv).innerHTML = ''

        if (departure.isTrainReplacement) {
          $('p.information', departureDiv).innerHTML += '<span class="important">Train Replacement Coach</span> '
          $('p.information', departureDiv).className = 'information important'
        } else {
          $('p.information', departureDiv).textContent = ''
        }

        $('p.information', departureDiv).innerHTML += departure.connections.map(connection => {
          return `<span>Change at ${connection.changeAt} for ${connection.for}</span>`
        }).join(', ')
      } else {
        $('p.title', departureDiv).textContent = `Bay ${bay} - No Departures`
        $('p.stopsAt', departureDiv).textContent = ''
        $('p.information', departureDiv).textContent = ''
      }
    })
  })
}

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
  let start = parseInt(search.query.start) || 59
  let size = parseInt(search.query.size) || 4

  bays = []
  for (let i = start; i < start + size; i++) {
    bays.push(i)
  }

  updateBody()
  setInterval(updateBody, 1000 * 30)
  setupClock()
})
