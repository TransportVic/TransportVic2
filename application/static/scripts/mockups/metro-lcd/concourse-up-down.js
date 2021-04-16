let forcedDirection = null

function shortenStoppingType(type) {
  if (type === 'Stops All Stations') return 'Stops All'
  if (type === 'Limited Express') return 'Ltd Express'
  return type
}

function setFullMessageActive(state) {
  if (state) {
    $('.fullMessage').style = 'display: flex;'
    $('.nextDepartures').style = 'display: none;'
  } else {
    $('.fullMessage').style = 'display: none;'
    $('.nextDepartures').style = 'display: block;'
  }
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen</p><p>for Announcements</p>'
  setFullMessageActive(true)
}

function shorternDestination (destination) {
  if (destination === 'Upper Ferntree Gully') return 'Upper F.T Gully'
  if (destination === 'Flemington Racecourse') return 'Flemington Races'
  return destination
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}

async function removeService(position) {
  let departureRows = Array.from(document.querySelectorAll('.departure'))
  let dividerDivs = Array.from(document.querySelectorAll('.greySeparator'))

  let departureRow = departureRows[position]
  let divider = dividerDivs[position]

  let rowHeight = parseInt(getComputedStyle(departureRow).height.slice(0, -2))
  let shiftWidth = rowHeight / 40

  for (let i = 1; i <= 40; i++) {
    departureRow.style = `margin-top: -${i * shiftWidth}px`
    await asyncPause(1)
  }

  departureRow.parentElement.removeChild(departureRow)
  if (divider) { // last element may not have
    divider.parentElement.removeChild(divider)
  }
}

let services = [null, null, null, null]

function getServiceID(departure) {
  if (!departure) return null
  return departure.sch + departure.route + departure.dest
}

let previousStarts = [0]

function updateBody(firstTime, n) {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()
    setFullMessageActive(false)

    try {
      let departures = {
        'U': [],
        'D': []
      }

      let screenDepartures = []

      body.dep.forEach(departure => {
        departures[departure.d].push(departure)
      })

      // Only check shifts at certain points (otherwise it will run a shift for every service after the initial shift)
      let starts = [0]

      if (forcedDirection) {
        let directionName = forcedDirection[0].toUpperCase() + forcedDirection.slice(1)
        screenDepartures = departures[directionName]
      } else if (departures.U.length === 0 || departures.D.length === 0) {
        screenDepartures = [...departures.U, ...departures.D].slice(0, 4)
      } else if (departures.U.length === 1) {
        screenDepartures = [...departures.U, ...departures.D.slice(0, 3)]
        starts = [0, 1]
      } else if (departures.D.length === 1) {
        screenDepartures = [...departures.U.slice(0, 3), ...departures.D]
        starts = [0, 3]
      } else {
        screenDepartures = [...departures.U.slice(0, 2), ...departures.D.slice(0, 2)]
        starts = [0, 2]
      }

      if (previousStarts.join() !== starts.join() && !firstTime) {
        starts = starts.concat(previousStarts)
      }

      previousStarts = starts

      screenDepartures = [...screenDepartures, null, null, null, null].slice(0, 4)

      let offset = 0
      let toRemove = -1

      screenDepartures.forEach((departure, i) => {
        let serviceID = getServiceID(departure)
        let previousID = services[i]

        if (starts.includes(i) && serviceID !== previousID && previousID !== null && toRemove === -1) {
          offset = 1
          $('.nextDepartures').innerHTML += `<div class="greySeparator" style="display: block;"></div>
<div class="departure">
  <div class="details">
      <div class="top"><span class="departureTime">--</span><span class="destination">--</span></div><span class="stoppingType">--</span></div>
  <div class="platformArea"><span class="title">PLAT</span><span class="platform">--</span></div>
  <div class="timeToDepartureArea"><span class="title">Minutes</span><span class="timeToDeparture">--</span></div>
</div>`
          toRemove = i
        }

        services[i] = serviceID

        let index = i + offset

        let departureRows = Array.from(document.querySelectorAll('.departure'))
        let dividerDivs = Array.from(document.querySelectorAll('.greySeparator'))

        let departureRow = departureRows[index]
        let dividerDiv = dividerDivs[index]

        if (departure) {
          if (dividerDiv) dividerDiv.style = 'display: block;'
          if (departure.v) departureRow.className = 'departure vline'
          else departureRow.className = 'departure'
          departureRow.style = 'display: flex;'
          $('.departureTime', departureRow).textContent = formatTimeB(new Date(departure.sch))
          $('.destination', departureRow).textContent = shorternDestination(departure.dest)

          let stoppingType = shortenStoppingType(departure.type)
          if (departure.via) {
            stoppingType += ' via ' + departure.via
          }

          $('.stoppingType', departureRow).textContent = stoppingType
          $('.platform', departureRow).textContent = departure.plt

          if (departure.est) {
            let minutesToDeparture = rawMinutesToDeparture(new Date(departure.est))
            if (minutesToDeparture > 0) {
              $('.timeToDepartureArea .title', departureRow).style = 'display: block;'
              $('.timeToDeparture', departureRow).textContent = minutesToDeparture
              $('.timeToDeparture', departureRow).className = 'timeToDeparture'
            } else {
              $('.timeToDepartureArea .title', departureRow).style = 'display: none;'
              $('.timeToDeparture', departureRow).textContent = 'NOW'
              $('.timeToDeparture', departureRow).className = 'timeToDeparture now'
            }
          } else {
            $('.timeToDepartureArea .title', departureRow).style = 'display: block;'
            $('.timeToDeparture', departureRow).textContent = '--'
            $('.timeToDeparture', departureRow).className = 'timeToDeparture now'
          }
        } else {
          if (dividerDiv) dividerDiv.style = 'display: none;'
          departureRow.className = 'departure'
          departureRow.style = 'display: none;'
        }
      })

      if (toRemove !== -1) removeService(toRemove)
    } catch (e) {
      setListenAnnouncements()
    }
  })
}


$.ready(() => {
  if (search.query.d) {
    forcedDirection = search.query.d[0].toUpperCase()
  }

  updateBody(true)
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})
