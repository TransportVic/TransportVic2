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
    $('.content').className = 'content messages'
  } else {
    $('.content').className = 'content'
  }
}

function getEstimatedDepartureTime(estimatedDepartureTime) {
  if (estimatedDepartureTime) {
    let diff = new Date(estimatedDepartureTime) - new Date()
    diff /= 1000 * 60
    if (diff <= 1) {
      return 'Now'
    } else {
      return  `${Math.round(diff)} min`
    }
  } else {
    return '-- min'
  }
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setMessagesActive(true)

    let {busDepartures, trainDepartures} = body

    let maxBusDepartures = trainDepartures ? 4 : 7

    let paddedBusDepartures = [...busDepartures, null, null, null, null, null, null, null].slice(0, maxBusDepartures)
    let paddedTrainDepartures = [...trainDepartures, null, null].slice(0, 2)

    paddedBusDepartures.forEach((busDeparture, i) => {
      let departureRow = $(`.timings .row:nth-child(${i + 2})`)
      if (busDeparture) {
        let shortDest = busDeparture.destination.split('/')[0]
        let scheduled = formatTime(new Date(busDeparture.scheduledDepartureTime))
        let estimated = getEstimatedDepartureTime(busDeparture.estimatedDepartureTime)

        departureRow.innerHTML = `
<div class="route-number">
  <div class="type type-bus"></div>
  <span class="route">${busDeparture.routeNumber}</span>
</div>
<div class="destination">
  <span class="dest">${shortDest}</span>
</div>
<span class="scheduled">${scheduled}</span>
<span class="departing">${estimated}</span>
`
      } else {
        departureRow.innerHTML = ''
      }
    })

    paddedTrainDepartures.forEach((trainDeparture, i) => {
      let departureRow = $(`.timings .row:nth-child(${i + 7})`)
      if (trainDeparture) {
        let scheduled = formatTime(new Date(trainDeparture.scheduledDepartureTime))
        let estimated = getEstimatedDepartureTime(trainDeparture.estimatedDepartureTime)

        departureRow.innerHTML = `
<div class="route-number">
  <div class="type type-metro-train"></div>
  <img class="train-icon" src="/static/images/mockups/metro-train.svg">
</div>
<div class="destination">
  <span class="dest">${trainDeparture.destination}</span>
  <span class="platform">Platform ${trainDeparture.platform}</span>
</div>
<span class="scheduled">${scheduled}</span>
<span class="departing">${estimated}</span>
`
      } else {
        departureRow.innerHTML = ''
      }
    })
  })
}

function updateClock() {
  $('#current-time').textContent = formatTime(new Date())
}

$.ready(() => {
  let t = new Date()

  setInterval(updateBody, 1000 * 30)
  updateBody()

  setTimeout(() => {
    updateClock()
    setInterval(updateClock, 1000)
  }, t % 1000)
})
