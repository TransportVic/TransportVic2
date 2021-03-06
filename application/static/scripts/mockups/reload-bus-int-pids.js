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
    if (err || body.error) return setMessagesActive(true)

    try {
      let {busDepartures, trainDepartures} = body

      let services = []
      let groupedDepartures = {}

      busDepartures.forEach(departure => {
        if (!services.includes(departure.sortNumber)) {
          services.push(departure.sortNumber)
          groupedDepartures[departure.sortNumber] = {}
        }
      })
      services.forEach(service => {
        let serviceDepartures = busDepartures.filter(d => d.sortNumber === service)
        let serviceDestinations = []

        serviceDepartures.forEach(departure => {
          let destination = departure.destination + departure.loopDirection
          if (!serviceDestinations.includes(destination)) {
            serviceDestinations.push(destination)
            groupedDepartures[service][destination] =
              serviceDepartures.filter(d => d.destination + d.loopDirection === destination)
              .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
          }
        })
      })

      let sortedBusDepartures = []
      services = services.sort((a, b) => a - b)
      services.forEach(service => {
        let directions = groupedDepartures[service]
        Object.keys(directions).forEach(direction => {
          let departures = directions[direction]
          sortedBusDepartures = sortedBusDepartures.concat(departures.slice(0, 2))
        })
      })

      let maxBusDepartures = trainDepartures ? 4 : 7
      let paddedBusDepartures

      let bay = location.pathname.slice(-1)
      if (trainDepartures && bay === '*') {
        paddedBusDepartures = [...busDepartures, null, null, null, null, null, null, null].slice(0, maxBusDepartures)
      } else {
        paddedBusDepartures = [...sortedBusDepartures, null, null, null, null, null, null, null].slice(0, maxBusDepartures)
      }

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

      if (trainDepartures) {
        let paddedTrainDepartures = [...trainDepartures, null, null].slice(0, 2)
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
      }
    } catch (e) {
      setListenAnnouncements()
    }
  })
}

function updateClock() {
  $('#current-time').textContent = formatTime(new Date())
}

$.ready(() => {
  let t = new Date()

  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))

  setTimeout(() => {
    updateClock()
    setInterval(updateClock, 1000)
  }, t % 1000)
})
