let bays = []

let currentlyDisplaying = ''

function setListenAnnouncements() {
  if (currentlyDisplaying !== 'announcements') {
    currentlyDisplaying = 'announcements'
    $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
    setFullMessageActive(true)
  }
}

function setFullMessageActive(active) {
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
    setFullMessageActive(false)

    try {
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

          if (departure.isRailReplacementBus) {
            $('p.information', departureDiv).innerHTML += '<span class="important">Train Replacement Coach</span> '
            $('p.information', departureDiv).className = 'information important'
          } else {
            $('p.information', departureDiv).textContent = ''
          }

          let connectionsTexts = []
          let locations = {}

          departure.connections.forEach(connection => {
            if (!locations[connection.changeAt]) locations[connection.changeAt] = []
            locations[connection.changeAt].push(connection.for)
          })

          connectionsTexts = Object.keys(locations).map(location => {
            let connections = locations[location]
            let last = connections.slice(-1)[0]

            let text = `<span>Change at ${location} for ${connections.slice(0, -1).join(', ')}`
            if (connections.length > 1) text += ` and ${last}`
            else text += connections[0]

            return text + '</span>'
          })

          $('p.information', departureDiv).innerHTML += connectionsTexts.join(', ')
        } else {
          $('p.title', departureDiv).textContent = `Bay ${bay} - No Departures`
          $('p.stopsAt', departureDiv).textContent = ''
          $('p.information', departureDiv).textContent = ''
        }
      })
    } catch (e) {
      setListenAnnouncements()
    }
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
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
  setupClock()
})
