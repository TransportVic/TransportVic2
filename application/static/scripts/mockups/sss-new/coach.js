let bays = ["59", "60", "61", "62"]

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  if (time.getHours() >= 12)
    mainTime += 'pm'
  else
    mainTime += 'am'

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
        if (departure.isTrainReplacement) {
          $('p.information', departureDiv).textContent = 'Train Replacement Coach'
          $('p.information', departureDiv).className = 'information important'
        } else {
          $('p.information', departureDiv).textContent = ''
        }
      } else {
        $('p.title', departureDiv).textContent = `Bay ${bay} - No Departures`
        $('p.stopsAt', departureDiv).textContent = ''
        $('p.information', departureDiv).textContent = ''
      }
    })
  })
}

$.ready(() => {
  updateBody()
  setInterval(updateBody, 1000 * 30)
})
